// This script fixes the missing Total Products card
(function() {
  const oldRender = window.renderMetrics;
  window.renderMetrics = function(summary) {
    const grid = document.getElementById('metric-grid');
    const cards = [
      { icon: '??', value: fmt(summary.totalRevenue), label: 'Total Revenue' },
      { icon: '??', value: summary.totalOrders, label: 'Total Orders' },
      { icon: '??', value: fmt(summary.avgOrderValue), label: 'Avg Order Value' },
      { icon: '??', value: summary.totalProducts, label: 'Total Products' },
      { icon: '??', value: summary.totalUsers || 0, label: 'Total Users' },
      { icon: '??', value: summary.totalAdmins || 1, label: 'Admin Users' },
      {
        icon: '??', value: summary.outOfStockCount || 0, label: 'Out of Stock',
        cls: (summary.outOfStockCount || 0) > 0 ? 'danger' : ''
      },
      {
        icon: '??', value: summary.lowStockCount || 0, label: 'Low Stock',
        cls: (summary.lowStockCount || 0) > 0 ? 'warning' : ''
      }
    ];
    grid.innerHTML = cards.map(c => \
      <div class=\"m-card \\">
        <div class=\"m-icon\">\</div>
        <div class=\"m-value\">\</div>
        <div class=\"m-label\">\</div>
      </div>\).join('');
  };
})();
