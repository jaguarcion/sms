require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const api = require('./api');
const db = require('./db');
const express = require('express');
const cors = require('cors');

// Env
const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = parseInt(process.env.ADMIN_TELEGRAM_ID, 10);
const firebaseAuthUrl = process.env.FIREBASE_AUTH_URL;

if (!token || !adminId) {
  console.error('Please specify TELEGRAM_BOT_TOKEN and ADMIN_TELEGRAM_ID in .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Setup Express API for Web Interface
const app = express();

const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'], // Allow standard local dev ports
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Rate Limiter to prevent Brute Force
const rateLimits = {};
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!rateLimits[ip]) {
    rateLimits[ip] = { count: 1, resetTime: now + 60000 };
  } else {
    if (now > rateLimits[ip].resetTime) {
      rateLimits[ip] = { count: 1, resetTime: now + 60000 };
    } else {
      rateLimits[ip].count++;
      if (rateLimits[ip].count > 50) {
        return res.status(429).json({ error: "Слишком много запросов. Подождите 1 минуту." });
      }
    }
  }
  next();
});

// SSE Clients
let sseClients = [];
function broadcastEvent(type, payload) {
  const data = JSON.stringify({ type, payload });
  sseClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {}
  });
}

// Active Sessions tracking
const activeSessions = {};

// API Auth Middleware
app.use((req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  // Read dynamically to allow instant updates
  let currentPassword = process.env.ADMIN_PASSWORD;
  
  // Fallback: manually parse .env if process.env.ADMIN_PASSWORD is missing due to dotenvx caching
  if (!currentPassword) {
    try {
      const fs = require('fs');
      const envContent = fs.readFileSync('.env', 'utf8');
      const match = envContent.match(/ADMIN_PASSWORD=(.*)/);
      if (match && match[1]) currentPassword = match[1].trim();
    } catch(e) {}
  }
  
  currentPassword = currentPassword || "admin123";

  const queryToken = req.query.token;

  if (authHeader === `Bearer ${currentPassword}` || queryToken === currentPassword) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    
    // Only track actual API calls or page loads, not SSE pings if they exist
    if (req.path !== '/api/events') {
      activeSessions[ip] = {
        ip,
        userAgent,
        lastSeen: Date.now()
      };
    }
    req.clientIp = ip;
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// Ensure admin exists in DB
db.addUser(adminId, 'admin');

// Simple state management for waiting user input
const userStates = {};

// Cache auth data to prevent 500 rate-limit errors from Fanytel
let cachedAuthData = null;
let lastLoginTime = 0;
let fanytelAuthFailed = false;

async function clearAuthCache() {
  cachedAuthData = null;
  lastLoginTime = 0;
  fanytelAuthFailed = true; // Mark as failed so polling stops until re-authorized
  await db.setSetting('fanytel_username', null);
  await db.setSetting('fanytel_token', null);
}

async function getAuthData() {
  const now = Date.now();

  // First, check if we have a valid cached token in memory
  if (cachedAuthData && now - lastLoginTime < 30 * 60 * 1000) {
    return cachedAuthData;
  }

  // Next, try to get from database
  const savedUsername = await db.getSetting('fanytel_username');
  const savedToken = await db.getSetting('fanytel_token');
  
  if (savedUsername && savedToken) {
    cachedAuthData = { username: savedUsername, token: savedToken };
    lastLoginTime = now;
    return cachedAuthData;
  }

  try {
    cachedAuthData = await api.login(firebaseAuthUrl);
    lastLoginTime = now;
    fanytelAuthFailed = false; // Successfully authorized!
    
    // Save to DB so we never need the Firebase URL again!
    await db.setSetting('fanytel_username', cachedAuthData.username);
    await db.setSetting('fanytel_token', cachedAuthData.token);

    return cachedAuthData;
  } catch (err) {
    if (err.message && err.message.includes('401')) {
      fanytelAuthFailed = true;
    }
    throw err;
  }
}

// Keyboards
const getAdminKeyboard = () => {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '📱 Купленные номера' }, { text: '🛒 Купить номер' }],
        [{ text: '💰 Баланс' }, { text: '📱 Мои номера' }] // Admin can also have numbers assigned to themselves
      ],
      resize_keyboard: true
    }
  };
};

const getClientKeyboard = () => {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '📱 Мои номера' }],
        [{ text: '💬 Общая история SMS' }]
      ],
      resize_keyboard: true
    }
  };
};

// ---------------------------------------------------------
// Bot Message Handlers
// ---------------------------------------------------------

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  // Add/Check User
  await db.addUser(chatId, chatId === adminId ? 'admin' : 'client', msg.from?.first_name, msg.from?.username);
  const isAdmin = (chatId === adminId);
  
  const knownCommands = ['/start', '💰 Баланс', '📱 Купленные номера', '🛒 Купить номер', '📱 Мои номера', '💬 Общая история SMS'];

  // Handle states (e.g. waiting for user ID)
  if (userStates[chatId]) {
    if (knownCommands.includes(text)) {
      // User pressed a menu button, cancel the state
      delete userStates[chatId];
    } else {
      const state = userStates[chatId];
      if (state.action === 'assign_number') {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId) || targetId <= 0) {
          return bot.sendMessage(chatId, "Пожалуйста, введите корректный числовой Telegram ID.");
        }
        
        try {
          // Find existing number from DB to retain its token
          let numberRow = await db.getNumber(state.number);
          
          // If not in DB (e.g. purchased outside the bot or before DB creation), fetch from Fanytel
          if (!numberRow) {
            const authData = await getAuthData();
            const myNumbers = await api.listMyNumbers(authData.username, authData.token);
            const fanytelNum = myNumbers.find(n => n.number === state.number);
            
            if (fanytelNum) {
              numberRow = {
                number: fanytelNum.number,
                username: authData.username,
                token: authData.token
              };
            }
          }

          if (numberRow && numberRow.telegram_id && numberRow.telegram_id !== targetId) {
            return bot.sendMessage(chatId, `❌ Ошибка: Этот номер (${state.number}) ранее принадлежал другому клиенту (${numberRow.telegram_id}). В целях безопасности вы не можете передать его новому клиенту.`);
          }

          if (numberRow) {
            await db.addNumber(state.number, targetId, numberRow.username, numberRow.token);
            bot.sendMessage(chatId, `Успех! Номер +${state.number} назначен пользователю ${targetId}.`);
            bot.sendMessage(targetId, `Вам выдан новый номер: +${state.number}!`);
          } else {
            bot.sendMessage(chatId, "Ошибка: Номер не найден в базе Fanytel.");
          }
        } catch (err) {
          bot.sendMessage(chatId, "Ошибка при назначении: " + err.message);
        }
        
        delete userStates[chatId];
        return;
      }
    }
  }

  // Handle Commands & Buttons
  switch (text) {
    case '/start':
      const kb = isAdmin ? getAdminKeyboard() : getClientKeyboard();
      bot.sendMessage(chatId, `Добро пожаловать!\nВаш ID: <code>${chatId}</code>`, { parse_mode: 'HTML', ...kb });
      break;

    case '💰 Баланс':
      if (!isAdmin) return;
      try {
        const authData = await getAuthData();
        const balance = await api.getBalance(authData.username, authData.token);
        bot.sendMessage(chatId, `<b>Баланс Fanytel:</b> $${balance}`, { parse_mode: 'HTML' });
      } catch (err) {
        bot.sendMessage(chatId, `Ошибка Fanytel: ${err.message}`);
      }
      break;

    case '📱 Купленные номера':
      if (!isAdmin) return;
      bot.sendMessage(chatId, "Загрузка купленных номеров...");
      try {
        const authData = await getAuthData();
        const myNumbers = await api.listMyNumbers(authData.username, authData.token);
        
        if (myNumbers.length === 0) {
          return bot.sendMessage(chatId, "Нет купленных номеров.");
        }

        // Generate Inline Keyboard
        const inlineKeyboard = myNumbers.map(n => [{
          text: `+${n.number}`,
          callback_data: `admin_num_${n.number}`
        }]);

        bot.sendMessage(chatId, "Ваши купленные номера Fanytel:", {
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      } catch (err) {
        bot.sendMessage(chatId, "Ошибка получения номеров: " + err.message);
      }
      break;

    case '🛒 Купить номер':
      if (!isAdmin) return;
      bot.sendMessage(chatId, "Поиск дешевых номеров США...");
      try {
        const authData = await getAuthData();
        const numbers = await api.listNumbers(authData.username, authData.token);
        
        if (numbers.length === 0) {
          return bot.sendMessage(chatId, "Нет номеров до $2.");
        }

        // Fetch historical numbers to filter out recycled numbers
        const historicalNumbers = await db.getAllHistoricalNumbers();
        const safeNumbers = numbers.filter(n => !historicalNumbers.includes(n.number));

        if (safeNumbers.length === 0) {
          return bot.sendMessage(chatId, "Нет безопасных (новых) номеров до $2.");
        }

        // Take top 5 safe numbers
        const inlineKeyboard = safeNumbers.slice(0, 5).map(n => [{
          text: `+${n.number} ($${n.setup_price}) - Купить`,
          callback_data: `buy_num_${n.number}`
        }]);

        bot.sendMessage(chatId, "Доступные номера (США):", {
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      } catch (err) {
        bot.sendMessage(chatId, "Ошибка: " + err.message);
      }
      break;

    case '📱 Мои номера':
      try {
        const numbers = await db.getNumbersByUser(chatId);
        if (numbers.length === 0) {
          return bot.sendMessage(chatId, "У вас пока нет номеров.");
        }

        const inlineKeyboard = numbers.map(n => [{
          text: `+${n.number}`,
          callback_data: `client_num_${n.number}`
        }]);

        bot.sendMessage(chatId, "Ваши номера:", {
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      } catch (err) {
        bot.sendMessage(chatId, "Ошибка: " + err.message);
      }
      break;

    case '💬 Общая история SMS':
      try {
        const history = await db.getAllSmsForUser(chatId);
        if (history.length === 0) {
          return bot.sendMessage(chatId, "История SMS пуста.");
        }

        let msgText = "<b>Последние SMS:</b>\n\n";
        history.forEach(h => {
          msgText += `На номер: +${h.number}\nОт: ${h.sender}\nТекст: ${h.message_text}\n---\n`;
        });
        
        bot.sendMessage(chatId, msgText, { parse_mode: 'HTML' });
      } catch (err) {
        bot.sendMessage(chatId, "Ошибка: " + err.message);
      }
      break;
  }
});

// ---------------------------------------------------------
// Callback Queries (Inline Buttons)
// ---------------------------------------------------------

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  try {
    if (data.startsWith('admin_num_')) {
      const numStr = data.replace('admin_num_', '');
      
      const authData = await getAuthData();
      const myNumbers = await api.listMyNumbers(authData.username, authData.token);
      const numberData = myNumbers.find(n => n.number === numStr);
      
      const dbNumber = await db.getNumber(numStr);
      const assignedTo = dbNumber && dbNumber.telegram_id ? dbNumber.telegram_id : "Не назначен";

      let text = `<b>Номер:</b> +${numStr}\n`;
      if (numberData) {
        text += `<b>Действует до:</b> ${numberData.renewaldate}\n`;
      }
      text += `<b>Привязан к Telegram ID:</b> ${assignedTo}`;

      const kb = [
        [{ text: 'Назначить пользователя', callback_data: `admin_assign_${numStr}` }]
      ];
      
      if (dbNumber && dbNumber.telegram_id) {
        kb.push([{ text: 'Открепить пользователя', callback_data: `admin_unassign_${numStr}` }]);
      }
      
      kb.push([{ text: '🔙 Вернуться', callback_data: 'admin_back_to_nums' }]);

      bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: kb }
      });
    }
    else if (data === 'admin_back_to_nums') {
      const authData = await getAuthData();
      const myNumbers = await api.listMyNumbers(authData.username, authData.token);
      const inlineKeyboard = myNumbers.map(n => [{
        text: `+${n.number}`,
        callback_data: `admin_num_${n.number}`
      }]);
      bot.editMessageText("Ваши купленные номера Fanytel:", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    }
    else if (data.startsWith('admin_assign_')) {
      const numStr = data.replace('admin_assign_', '');
      userStates[chatId] = { action: 'assign_number', number: numStr };
      bot.sendMessage(chatId, `Введите Telegram ID пользователя, чтобы привязать номер +${numStr}:`);
    }
    else if (data.startsWith('admin_unassign_')) {
      const numStr = data.replace('admin_unassign_', '');
      const numberRow = await db.getNumber(numStr);
      if (numberRow) {
        await db.deactivateNumber(numStr);
        bot.sendMessage(chatId, `Пользователь успешно откреплен от номера +${numStr}.`);
      } else {
        bot.sendMessage(chatId, "Ошибка: Номер не найден в локальной базе.");
      }
    }
    else if (data.startsWith('buy_num_')) {
      bot.sendMessage(chatId, "Процесс покупки...");
      const numStr = data.replace('buy_num_', '');
      
      const authData = await getAuthData();
      const numbers = await api.listNumbers(authData.username, authData.token);
      const numData = numbers.find(n => n.number === numStr);
      
      if (numData) {
        await api.purchaseNumber(numData, authData.username, authData.token);
        await db.addNumber(numData.number, adminId, authData.username, authData.token);
        bot.sendMessage(chatId, `Номер +${numStr} успешно куплен! Вы можете найти его в "Купленные номера" и назначить пользователю.`);
      } else {
        bot.sendMessage(chatId, "Номер больше недоступен.");
      }
    }
    else if (data.startsWith('client_num_')) {
      const numStr = data.replace('client_num_', '');
      const kb = [[{ text: '💬 История SMS', callback_data: `client_sms_${numStr}` }]];
      bot.sendMessage(chatId, `Управление номером +${numStr}:`, { reply_markup: { inline_keyboard: kb } });
    }
    else if (data.startsWith('client_sms_')) {
      const numStr = data.replace('client_sms_', '');
      const history = await db.getSmsForNumber(numStr);
      if (history.length === 0) {
        return bot.sendMessage(chatId, `Нет сохраненных SMS для +${numStr}`);
      }
      let msgText = `<b>Последние SMS для +${numStr}:</b>\n\n`;
      history.forEach(h => {
        msgText += `От: ${h.sender}\nТекст: ${h.message_text}\n---\n`;
      });
      bot.sendMessage(chatId, msgText, { parse_mode: 'HTML' });
    }
  } catch (error) {
    bot.sendMessage(chatId, "Ошибка: " + error.message);
  }
  
  // Acknowledge callback
  bot.answerCallbackQuery(query.id);
});

// ---------------------------------------------------------
// Background Polling Loop for SMS (Every 3 seconds)
// ---------------------------------------------------------

async function pollSms() {
  try {
    // Only poll if we have an admin and firebase URL configured
    if (!firebaseAuthUrl) return;
    
    // Stop spamming logs if Fanytel is unauthorized. It will resume when admin checks stats/settings.
    if (fanytelAuthFailed) return;

    // We login once per poll (or we could cache the token)
    const authData = await getAuthData();
    const chats = await api.getSmsHistory(authData.username, authData.token);
    
    for (const chat of chats) {
      const messageId = chat.lastMessageId;
      const sender = chat.peer;
      let text = chat.lastMessage;
      
      // Fanytel appends [13024552793] to the end of the message to identify the target number
      const match = text.match(/\[(\d+)\]\s*$/);
      if (!match) continue; // Cannot identify target number
      
      const targetNumberStr = match[1];
      // Clean up the text
      text = text.replace(/\[\d+\]\s*$/, '').trim();
      
      // Find who owns this number
      const numRow = await db.getNumber(targetNumberStr);
      if (!numRow) continue; // Not assigned in our DB
      
      // Try to add to history. If it's a new message, addSmsRecord returns true
      const isNew = await db.addSmsRecord(numRow.number, messageId, sender, text);
      
      if (isNew) {
        broadcastEvent('new_sms', { id: messageId, number: numRow.number, sender, message_text: text, received_at: Date.now() });
        if (numRow.telegram_id) {
          const smsText = `🔔 <b>Новое SMS на номер +${numRow.number}</b>\nОт: ${sender}\nСообщение:\n${text}`;
          bot.sendMessage(numRow.telegram_id, smsText, { parse_mode: 'HTML' });
        }
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('401')) {
      await clearAuthCache();
    }
    console.error("Polling error:", err.message);
  }
}

async function checkExpirations() {
  try {
    if (!firebaseAuthUrl || fanytelAuthFailed) return;
    const authData = await getAuthData();
    const myNumbers = await api.listMyNumbers(authData.username, authData.token);
    
    // Check locally assigned numbers
    const activeDbNumbers = await db.getActiveNumbers();
    
    for (const dbNum of activeDbNumbers) {
      if (!dbNum.telegram_id) continue; // Skip unassigned

      const fanytelNum = myNumbers.find(n => n.number === dbNum.number);
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      
      if (!fanytelNum) {
        // Number no longer exists in Fanytel! It was purged.
        await db.deactivateNumber(dbNum.number);
        try {
           bot.sendMessage(dbNum.telegram_id, `⚠️ Ваш номер +${dbNum.number} был удален провайдером. Обратитесь к администратору для выдачи нового номера.`);
        } catch (e) {}
        bot.sendMessage(adminId, `🔴 Номер +${dbNum.number} был удален с аккаунта Fanytel и откреплен от клиента ${dbNum.telegram_id}.`);
        continue;
      }

      if (fanytelNum.renewaldate) {
        // Fanytel dates are 'YYYY-MM-DD'
        const renewalDate = new Date(fanytelNum.renewaldate).getTime();
        const daysLeft = (renewalDate - now) / msPerDay;

        if (daysLeft < 0) {
          // Expired
          await db.deactivateNumber(dbNum.number);
          try {
            bot.sendMessage(dbNum.telegram_id, `⚠️ Ваш номер +${dbNum.number} истек и был откреплен. Пожалуйста, обратитесь к администратору для продления или получения нового номера.`);
          } catch (e) {}
          bot.sendMessage(adminId, `🔴 Номер +${dbNum.number} истек (${fanytelNum.renewaldate}) и был откреплен от пользователя ${dbNum.telegram_id}.`);
        } else if (daysLeft <= 3 && daysLeft >= 0) {
          // Warning
          bot.sendMessage(adminId, `⚠️ <b>Напоминание:</b> Номер +${dbNum.number} (клиент: <code>${dbNum.telegram_id}</code>) истекает через ${Math.ceil(daysLeft)} дней (${fanytelNum.renewaldate}). Не забудьте пополнить баланс и продлить!`, { parse_mode: 'HTML' });
        }
      }
    }
  } catch (err) {
    console.error("Expiration check error:", err.message);
  }
}

// Start polling SMS every 3 seconds
setInterval(pollSms, 3000);

// Run expiration check 5 seconds after startup, then every 24 hours
setTimeout(checkExpirations, 5000);
setInterval(checkExpirations, 24 * 60 * 60 * 1000);

// Auto-cleanup SMS older than 30 days every 12 hours
setInterval(async () => {
  try {
    const deletedCount = await db.deleteOldSms(30);
    if (deletedCount > 0) {
      console.log(`Auto-cleanup: Deleted ${deletedCount} old SMS messages.`);
    }
  } catch (err) {
    console.error("SMS cleanup error:", err.message);
  }
}, 12 * 60 * 60 * 1000);

// Express Endpoints
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  sseClients.push(res);
  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

app.get('/api/stats', async (req, res) => {
  try {
    const authData = await getAuthData();
    const balance = await api.getBalance(authData.username, authData.token);
    const users = await db.getAllUsers();
    const numbers = await db.getActiveNumbers();
    
    res.json({
      balance,
      totalUsers: users.length,
      totalNumbers: numbers.length,
      assignedNumbers: numbers.filter(n => n.telegram_id !== null).length
    });
  } catch (err) {
    if (err.message && err.message.includes('401')) {
      await clearAuthCache();
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/numbers', async (req, res) => {
  try {
    const activeDbNumbers = await db.getActiveNumbers();
    
    // Attempt to merge with Fanytel data to get renewaldate
    try {
      const authData = await getAuthData();
      const fanytelNumbers = await api.listMyNumbers(authData.username, authData.token);
      
      // Auto-sync: add any numbers from Fanytel that are missing in local DB
      for (const fNum of fanytelNumbers) {
        if (!activeDbNumbers.find(dbNum => dbNum.number === fNum.number)) {
          await db.addNumber(fNum.number, null, authData.username, authData.token);
          activeDbNumbers.push({
            id: 'sync_' + fNum.number,
            number: fNum.number,
            telegram_id: null,
            username: authData.username,
            token: authData.token,
            active: 1
          });
        }
      }

      const merged = activeDbNumbers.map(dbNum => {
        const fNum = fanytelNumbers.find(n => n.number === dbNum.number);
        return {
          ...dbNum,
          renewaldate: fNum ? fNum.renewaldate : null
        };
      });
      res.json(merged);
    } catch (e) {
      // Fallback if Fanytel API fails
      res.json(activeDbNumbers);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    const activeNumbers = await db.getActiveNumbers();
    
    const enhancedUsers = users.map(u => {
      const userNumbers = activeNumbers.filter(n => n.telegram_id === u.telegram_id).map(n => n.number);
      return {
        ...u,
        assigned_numbers: userNumbers
      };
    });
    res.json(enhancedUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:telegram_id/notes', async (req, res) => {
  try {
    const { notes, tags } = req.body;
    await db.updateUserNotes(req.params.telegram_id, notes, tags);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sms/:number', async (req, res) => {
  try {
    const rows = await db.getSmsForNumber(req.params.number);
    // Anti-DoS Limit 
    res.json(rows.slice(0, 100));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/numbers/assign', async (req, res) => {
  try {
    const { number, telegram_id } = req.body;
    const targetId = parseInt(telegram_id, 10);
    const numberRow = await db.getNumber(number);
    if (!numberRow) return res.status(404).json({ error: "Number not found in local DB" });
    
    if (numberRow.telegram_id && numberRow.telegram_id !== targetId) {
      return res.status(400).json({ error: `Этот номер ранее принадлежал другому клиенту (${numberRow.telegram_id}).` });
    }
    
    await db.addNumber(number, targetId, numberRow.username, numberRow.token);
    await db.updateUserRole(targetId, 'client');
    db.logAction('ASSIGN_NUMBER', req.clientIp, { number, telegram_id });
    
    // Notify the user via Telegram
    try {
      await bot.sendMessage(targetId, `✅ **Вам выдан новый номер:** \`+${number}\`\n\nТеперь все SMS, приходящие на этот номер, будут пересылаться сюда.`, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error(`Не удалось отправить уведомление пользователю ${targetId}:`, e.message);
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/numbers/unassign', async (req, res) => {
  try {
    const { number } = req.body;
    const numberRow = await db.getNumber(number);
    if (!numberRow) return res.status(404).json({ error: "Number not found" });
    
    await db.deactivateNumber(number);
    db.logAction('UNASSIGN_NUMBER', req.clientIp, { number });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [F-1] Purchase number from web
app.get('/api/available-numbers', async (req, res) => {
  try {
    const authData = await getAuthData();
    const available = await api.listNumbers(authData.username, authData.token);
    // Filter out previously used numbers from our DB
    const usedNumbers = await db.getAllHistoricalNumbers();
    const cleanNumbers = available.filter(n => !usedNumbers.includes(n.number));
    res.json(cleanNumbers.slice(0, 50)); // Return top 50
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/numbers/purchase', async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: "Number is required" });
    
    const authData = await getAuthData();
    await api.purchaseNumber({ number }, authData.username, authData.token);
    
    // Save to our DB as unassigned
    await db.addNumber(number, null, authData.username, authData.token);
    db.logAction('PURCHASE_NUMBER', req.clientIp, { number });
    res.json({ success: true, number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [F-2] Broadcast
app.post('/api/broadcast', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });
    
    const users = await db.getAllUsers();
    let count = 0;
    
    for (const u of users) {
      if (u.role === 'admin') continue; // Skip admins
      
      if (u.telegram_id) {
        try {
          await bot.sendMessage(u.telegram_id, `📢 **Уведомление**\n\n${message}`, { parse_mode: 'Markdown' });
          count++;
        } catch (e) {
          console.log(`Failed to broadcast to ${u.telegram_id}:`, e.message);
        }
      }
    }
    
    db.logAction('BROADCAST', req.clientIp, { messageLength: message.length, usersCount: users.length });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sms', async (req, res) => {
  try {
    // Return last 100 sms globally, or all, simplified.
    // For this implementation, we will query from our sms_history if possible, 
    // but right now sms_history doesn't have a "getAll" method.
    // Let's add a quick query here:
    const rows = await new Promise((resolve, reject) => {
      db.db.all(`SELECT * FROM sms_history ORDER BY received_at DESC LIMIT 100`, [], (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sms/clear', async (req, res) => {
  try {
    const changes = await db.clearAllSms();
    db.logAction('CLEAR_SMS_HISTORY', req.clientIp, { deletedCount: changes });
    broadcastEvent('clear_sms', {});
    res.json({ success: true, count: changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit', async (req, res) => {
  try {
    const logs = await db.getAuditLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [F-4] Settings endpoints
app.get('/api/settings/status', async (req, res) => {
  try {
    const authData = await getAuthData();
    // Verify connection by getting balance
    const balance = await api.getBalance(authData.username, authData.token);
    res.json({ status: 'Online', balance: balance });
  } catch (err) {
    res.json({ status: 'Offline', error: err.message });
  }
});

app.get('/api/settings/sessions', (req, res) => {
  // Clear old sessions (older than 24 hours)
  const now = Date.now();
  for (const ip in activeSessions) {
    if (now - activeSessions[ip].lastSeen > 24 * 60 * 60 * 1000) {
      delete activeSessions[ip];
    }
  }
  const sessions = Object.values(activeSessions).sort((a, b) => b.lastSeen - a.lastSeen);
  res.json(sessions);
});

app.post('/api/settings/password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 5) {
      return res.status(400).json({ error: "Password must be at least 5 characters" });
    }
    
    // Security: Validate password to prevent Env Injection (\n, quotes, backticks)
    if (/[\r\n"'`]/.test(newPassword)) {
      return res.status(400).json({ error: "Пароль содержит недопустимые символы (кавычки или переносы строк)" });
    }
    
    // Update .env file
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '.env');
    
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (envContent.includes('ADMIN_PASSWORD=')) {
      envContent = envContent.replace(/ADMIN_PASSWORD=.*/g, `ADMIN_PASSWORD=${newPassword}`);
    } else {
      envContent += `\nADMIN_PASSWORD=${newPassword}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    
    // Update process.env for current runtime
    await db.setSetting('adminPassword', newPassword);
    currentPassword = newPassword;
    db.logAction('CHANGE_PASSWORD', req.clientIp, {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve Frontend in Production
const path = require('path');
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Fallback for React Router SPA (Express 5 compatible regex)
app.get(/^\/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web Admin API is running on http://localhost:${PORT}`);
});

console.log("Bot is running with buttons UI. Waiting for commands...");
