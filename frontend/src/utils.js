export const filterAndSortData = (data, keys, searchQuery, sortConfig) => {
  let result = data;
  
  if (searchQuery) {
    const lowerQ = searchQuery.toLowerCase();
    result = result.filter(item => keys.some(key => String(item[key]).toLowerCase().includes(lowerQ)));
  }

  if (sortConfig && sortConfig.key) {
    result = [...result].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (typeof valA === 'string' && !isNaN(valA) && valA !== '') valA = Number(valA);
      if (typeof valB === 'string' && !isNaN(valB) && valB !== '') valB = Number(valB);

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return result;
};

export const paginate = (data, currentPage, itemsPerPage) => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return data.slice(startIndex, startIndex + itemsPerPage);
};
