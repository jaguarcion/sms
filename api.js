const axios = require('axios');
const crypto = require('crypto');
const https = require('https');

class FanytelAPI {
  constructor() {
    // API constants
    this.baseUrl = 'https://api.fanytel.com:4443/api';
    this.agent = new https.Agent({ rejectUnauthorized: false });
    this.baseHeaders = {
      'host': 'api.fanytel.com:4443',
      'sec-ch-ua-platform': '"Windows"',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
      'sec-ch-ua-mobile': '?0',
      'accept': 'application/json',
      'origin': 'https://webdialer.fanytel.com',
      'sec-fetch-site': 'same-site',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'referer': 'https://webdialer.fanytel.com/',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'priority': 'u=1, i'
    };
  }

  // Calculate SHA256 for the given string (usually phone + password)
  _generateToken(username, password) {
    return crypto.createHash('sha256').update(username + password).digest('hex');
  }

  async login(firebaseAuthUrl) {
    try {
      const response = await axios.get(firebaseAuthUrl, { headers: this.baseHeaders, httpsAgent: this.agent });
      if (response.data && response.data.data && response.data.data.message === 'login success') {
        const username = response.data.data.username;
        const rawPassword = response.data.data.password.toString();
        const sha256Token = this._generateToken(username, rawPassword);
        
        return {
          username: username,
          rawPassword: rawPassword,
          token: sha256Token
        };
      }
      throw new Error('Login failed: ' + JSON.stringify(response.data));
    } catch (error) {
      console.error('Error logging in:', error.message);
      throw error;
    }
  }

  async getBalance(username, token) {
    try {
      const url = `${this.baseUrl}/getavailablebalance/${encodeURIComponent(username)}?password=${token}`;
      const response = await axios.get(url, { headers: this.baseHeaders, httpsAgent: this.agent });
      
      if (response.data && response.data.data && response.data.data.message) {
        return response.data.data.message[0].balance;
      }
      return 0;
    } catch (error) {
      console.error('Error getting balance:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async listNumbers(username, token) {
    try {
      const url = `${this.baseUrl}/listnumbers`;
      const headers = { ...this.baseHeaders, 'content-type': 'application/json' };
      const payload = { username: username, password: token };
      const response = await axios.post(url, payload, { headers, httpsAgent: this.agent });
      
      if (response.data && response.data.data && response.data.data.message) {
        return response.data.data.message.filter(num => 
          num.monthly_price === 0.99 && num.setup_price === 0.99 && num.country === 'US'
        );
      }
      return [];
    } catch (error) {
      console.error('Error listing numbers:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async listMyNumbers(username, token) {
    try {
      const url = `${this.baseUrl}/listmynumbers`;
      const headers = { ...this.baseHeaders, 'content-type': 'application/json' };
      const payload = { username: username, password: token };
      const response = await axios.post(url, payload, { headers, httpsAgent: this.agent });
      
      if (response.data && response.data.data && response.data.data.message) {
        return response.data.data.message;
      }
      return [];
    } catch (error) {
      console.error('Error listing my numbers:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async purchaseNumber(numberData, username, token) {
    try {
      const payload = {
        number: numberData.number,
        yearly: 0,
        username: username,
        password: token
      };
      
      const url = `${this.baseUrl}/purchasenumber`;
      const headers = { ...this.baseHeaders, 'content-type': 'application/json' };
      const response = await axios.post(url, payload, { headers, httpsAgent: this.agent });
      
      if (response.data && response.data.data && response.data.data.message === 'Number purchased Successfully') {
        return true;
      }
      throw new Error('Purchase failed: ' + JSON.stringify(response.data));
    } catch (error) {
      console.error('Error purchasing number:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async getSmsHistory(username, token) {
    try {
      const url = `${this.baseUrl}/sms_history/chats?username=${encodeURIComponent(username)}&password=${token}`;
      const headers = { ...this.baseHeaders, 'x-app-id': 'iamlivedbnew' };
      const response = await axios.get(url, { headers: headers, httpsAgent: this.agent });
      
      if (response.data && response.data.data) {
        return response.data.data; // Array of last messages
      }
      return [];
    } catch (error) {
      console.error('Error getting SMS history:', error.response ? error.response.data : error.message);
      throw error;
    }
  }
}

module.exports = new FanytelAPI();
