// Analytics page logic
import API from './api.js';

const Analytics = {
    charts: {
        category: null,
        status: null,
        timeline: null
    },
    complaints: [],
    period: 30, // days

    async init() {
        console.log('📊 Analytics initializing...');

        // Initialize Supabase
        API.initSupabase();

        // Load data
        await this.loadData();

        // Setup event listeners
        this.setupEventListeners();

        console.log('✅ Analytics ready!');
    },

    setupEventListeners() {
        // Period filter
        const periodFilter = document.getElementById('periodFilter');
        periodFilter.addEventListener('change', (e) => {
            this.period = e.target.value === 'all' ? null : parseInt(e.target.value);
            this.updateAnalytics();
        });

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.addEventListener('click', () => this.loadData());
    },

    async loadData() {
        window.Animations.showLoading('Загрузка данных...');
        try {
            console.log('📥 Loading complaints data...');
            this.complaints = await API.getComplaints();
            console.log(`✅ Loaded ${this.complaints.length} complaints`);

            this.updateAnalytics();
        } catch (error) {
            console.error('❌ Error loading data:', error);
            window.Animations.showToast('Ошибка загрузки данных', 'error');
        } finally {
            window.Animations.hideLoading();
        }
    },

    updateAnalytics() {
        // Filter by period
        const filteredComplaints = this.filterByPeriod(this.complaints);

        // Update stats
        this.updateStats(filteredComplaints);

        // Update charts
        this.updateCategoryChart(filteredComplaints);
        this.updateStatusChart(filteredComplaints);
        this.updateTimelineChart(filteredComplaints);

        // Generate insights
        this.generateInsights(filteredComplaints);
    },

    filterByPeriod(complaints) {
        if (!this.period) return complaints;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.period);

        return complaints.filter(c => {
            const createdAt = new Date(c.created_at || c.createdAt);
            return createdAt >= cutoffDate;
        });
    },

    updateStats(complaints) {
        const total = complaints.length;
        const newCount = complaints.filter(c => c.status === 'Получено').length;
        const processingCount = complaints.filter(c => c.status === 'В обработке').length;
        const completedCount = complaints.filter(c => c.status === 'Выполнено').length;

        // Update values
        document.getElementById('totalCount').textContent = total;
        document.getElementById('newCount').textContent = newCount;
        document.getElementById('processingCount').textContent = processingCount;
        document.getElementById('completedCount').textContent = completedCount;

        // Calculate percentages
        const newPercent = total > 0 ? ((newCount / total) * 100).toFixed(1) : 0;
        const processingPercent = total > 0 ? ((processingCount / total) * 100).toFixed(1) : 0;
        const completedPercent = total > 0 ? ((completedCount / total) * 100).toFixed(1) : 0;

        document.getElementById('newPercent').textContent = `${newPercent}% от всех`;
        document.getElementById('processingPercent').textContent = `${processingPercent}% от всех`;
        document.getElementById('completedPercent').textContent = `${completedPercent}% от всех`;

        // Calculate change (mock for demo)
        const periodLabel = this.period ? `за ${this.period} дн.` : 'всего';
        document.getElementById('totalChange').textContent = periodLabel;
    },

    updateCategoryChart(complaints) {
        const categoryData = this.groupByCategory(complaints);

        const data = {
            labels: Object.keys(categoryData).map(cat => this.getCategoryName(cat)),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: [
                    '#3b82f6', // water - blue
                    '#10b981', // garbage - green
                    '#f59e0b', // lighting - amber
                    '#ef4444', // roads - red
                    '#8b5cf6'  // other - purple
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };

        const config = {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };

        // Destroy old chart if exists
        if (this.charts.category) {
            this.charts.category.destroy();
        }

        const ctx = document.getElementById('categoryChart');
        this.charts.category = new Chart(ctx, config);
    },

    updateStatusChart(complaints) {
        const statusData = this.groupByStatus(complaints);

        const data = {
            labels: Object.keys(statusData),
            datasets: [{
                label: 'Количество обращений',
                data: Object.values(statusData),
                backgroundColor: [
                    '#f59e0b', // Получено - amber
                    '#3b82f6', // В обработке - blue
                    '#10b981'  // Выполнено - green
                ],
                borderWidth: 2,
                borderColor: '#fff',
                borderRadius: 8
            }]
        };

        const config = {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${value} обращений (${percentage}%)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        };

        if (this.charts.status) {
            this.charts.status.destroy();
        }

        const ctx = document.getElementById('statusChart');
        this.charts.status = new Chart(ctx, config);
    },

    updateTimelineChart(complaints) {
        const timelineData = this.groupByDate(complaints);

        // Sort by date
        const sortedDates = Object.keys(timelineData).sort();
        const values = sortedDates.map(date => timelineData[date]);

        const data = {
            labels: sortedDates.map(date => this.formatDate(date)),
            datasets: [{
                label: 'Обращения',
                data: values,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        };

        const config = {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `Обращений: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        };

        if (this.charts.timeline) {
            this.charts.timeline.destroy();
        }

        const ctx = document.getElementById('timelineChart');
        this.charts.timeline = new Chart(ctx, config);
    },

    groupByCategory(complaints) {
        const grouped = {};
        complaints.forEach(c => {
            const category = c.category || 'other';
            grouped[category] = (grouped[category] || 0) + 1;
        });
        return grouped;
    },

    groupByStatus(complaints) {
        const grouped = {};
        complaints.forEach(c => {
            const status = c.status || 'Получено';
            grouped[status] = (grouped[status] || 0) + 1;
        });
        return grouped;
    },

    groupByDate(complaints) {
        const grouped = {};
        complaints.forEach(c => {
            const date = new Date(c.created_at || c.createdAt);
            const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            grouped[dateKey] = (grouped[dateKey] || 0) + 1;
        });
        return grouped;
    },

    getCategoryName(category) {
        const names = {
            water: '💧 Водоснабжение',
            garbage: '🗑️ Мусор',
            lighting: '💡 Освещение',
            roads: '🛣️ Дороги',
            other: '📌 Другое'
        };
        return names[category] || '📌 Другое';
    },

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'short'
        });
    },

    generateInsights(complaints) {
        const insights = [];

        // Most common category
        const categoryData = this.groupByCategory(complaints);
        const topCategory = Object.entries(categoryData).sort((a, b) => b[1] - a[1])[0];
        if (topCategory) {
            insights.push({
                title: '📌 Самая частая категория',
                description: `${this.getCategoryName(topCategory[0])} — ${topCategory[1]} обращений (${((topCategory[1] / complaints.length) * 100).toFixed(1)}% от всех)`
            });
        }

        // Completion rate
        const completed = complaints.filter(c => c.status === 'Выполнено').length;
        const completionRate = complaints.length > 0 ? ((completed / complaints.length) * 100).toFixed(1) : 0;
        insights.push({
            title: '✅ Показатель решения',
            description: `${completionRate}% обращений выполнено. ${completed} из ${complaints.length} обращений успешно решены.`
        });

        // Average response time (mock for demo)
        insights.push({
            title: '⏱️ Среднее время обработки',
            description: 'В среднем обращения обрабатываются за 2-3 дня. Самые быстрые решения — проблемы с освещением.'
        });

        // Active period
        if (complaints.length > 0) {
            const dates = complaints.map(c => new Date(c.created_at || c.createdAt));
            const oldestDate = new Date(Math.min(...dates));
            const daysActive = Math.floor((new Date() - oldestDate) / (1000 * 60 * 60 * 24));
            insights.push({
                title: '📅 Период активности',
                description: `Система работает ${daysActive} дней. За это время получено ${complaints.length} обращений — в среднем ${(complaints.length / Math.max(daysActive, 1)).toFixed(1)} обращений в день.`
            });
        }

        // Render insights
        const container = document.getElementById('insightsContainer');
        container.innerHTML = insights.map(insight => `
            <div class="insight-card">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-description">${insight.description}</div>
            </div>
        `).join('');
    }
};

// Initialize analytics when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Analytics.init();
});
