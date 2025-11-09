// Admin panel logic
import API from './api.js';

const AdminPanel = {
    // Simple password (for hackathon demo only!)
    // In production, use proper authentication with Supabase Auth
    ADMIN_PASSWORD: 'admin123',
    isAuthenticated: false,

    init() {
        console.log('🔐 Admin panel initializing...');

        // Check if already logged in (session storage)
        const sessionAuth = sessionStorage.getItem('admin_authenticated');
        if (sessionAuth === 'true') {
            this.isAuthenticated = true;
            this.showDashboard();
        }

        // Setup login form
        const loginForm = document.getElementById('loginForm');
        loginForm.addEventListener('submit', (e) => this.handleLogin(e));

        // Setup logout button
        const logoutBtn = document.getElementById('logoutBtn');
        logoutBtn.addEventListener('click', () => this.handleLogout());
    },

    handleLogin(e) {
        e.preventDefault();
        const password = document.getElementById('password').value;

        if (password === this.ADMIN_PASSWORD) {
            this.isAuthenticated = true;
            sessionStorage.setItem('admin_authenticated', 'true');
            this.showDashboard();
            window.Animations.showToast('Вы успешно вошли в админ-панель', 'success');
        } else {
            window.Animations.showToast('Неверный пароль', 'error');
            window.Animations.shake(document.querySelector('.login-card'));
        }
    },

    handleLogout() {
        this.isAuthenticated = false;
        sessionStorage.removeItem('admin_authenticated');
        this.showLogin();
    },

    showLogin() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('adminDashboard').classList.add('hidden');
        document.getElementById('password').value = '';
    },

    showDashboard() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');

        // Initialize Supabase and load data
        API.initSupabase();
        this.loadComplaints();
    },

    async loadComplaints() {
        window.Animations.showLoading('Загрузка данных...');
        try {
            console.log('📥 Loading complaints for admin panel...');
            const complaints = await API.getComplaints();

            // Update statistics
            this.updateStatistics(complaints);

            // Render table
            this.renderComplaintsTable(complaints);

            console.log(`✅ Loaded ${complaints.length} complaints`);
        } catch (error) {
            console.error('❌ Error loading complaints:', error);
            window.Animations.showToast('Ошибка загрузки данных', 'error');
        } finally {
            window.Animations.hideLoading();
        }
    },

    updateStatistics(complaints) {
        const total = complaints.length;
        const newCount = complaints.filter(c => c.status === 'Получено').length;
        const processingCount = complaints.filter(c => c.status === 'В обработке').length;
        const completedCount = complaints.filter(c => c.status === 'Выполнено').length;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statNew').textContent = newCount;
        document.getElementById('statProcessing').textContent = processingCount;
        document.getElementById('statCompleted').textContent = completedCount;
    },

    renderComplaintsTable(complaints) {
        const tbody = document.getElementById('complaintsTableBody');

        if (complaints.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #718096;">
                        Нет обращений
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = complaints.map(complaint => this.createTableRow(complaint)).join('');

        // Add event listeners to status selects
        tbody.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => this.handleStatusChange(e));
        });
    },

    createTableRow(complaint) {
        const {
            id,
            public_id,
            title,
            category,
            status,
            created_at,
            photo_urls,
            description
        } = complaint;

        const date = new Date(created_at).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const categoryNames = {
            water: '💧 Вода',
            garbage: '🗑️ Мусор',
            lighting: '💡 Освещение',
            roads: '🛣️ Дороги',
            other: '📌 Другое'
        };

        const photoHtml = photo_urls && photo_urls.length > 0
            ? `<img src="${photo_urls[0]}" class="photo-thumb" alt="Photo" onclick="window.open('${photo_urls[0]}', '_blank')">`
            : '—';

        return `
            <tr data-id="${id}">
                <td><code>${public_id || id}</code></td>
                <td>
                    <strong>${title}</strong>
                    <br>
                    <small style="color: #718096;">${description.substring(0, 50)}${description.length > 50 ? '...' : ''}</small>
                </td>
                <td>${categoryNames[category] || category}</td>
                <td>
                    <select class="status-select" data-id="${id}" data-current="${status}">
                        <option value="Получено" ${status === 'Получено' ? 'selected' : ''}>Получено</option>
                        <option value="В обработке" ${status === 'В обработке' ? 'selected' : ''}>В обработке</option>
                        <option value="Выполнено" ${status === 'Выполнено' ? 'selected' : ''}>Выполнено</option>
                    </select>
                </td>
                <td><small>${date}</small></td>
                <td>${photoHtml}</td>
                <td>
                    <button class="view-btn" onclick="AdminPanel.viewDetails(${id})">
                        Подробнее
                    </button>
                </td>
            </tr>
        `;
    },

    async handleStatusChange(e) {
        const select = e.target;
        const id = parseInt(select.dataset.id);
        const currentStatus = select.dataset.current;
        const newStatus = select.value;

        if (newStatus === currentStatus) {
            return; // No change
        }

        // Confirm change
        const confirmed = confirm(`Изменить статус на "${newStatus}"?`);
        if (!confirmed) {
            select.value = currentStatus;
            return;
        }

        try {
            // Update status in database
            console.log(`📝 Updating complaint ${id} status to "${newStatus}"`);
            const updated = await API.updateStatus(id, newStatus);

            if (updated) {
                select.dataset.current = newStatus;
                console.log('✅ Status updated successfully');

                // Reload complaints to update statistics
                await this.loadComplaints();

                // Show success notification
                this.showNotification('✅ Статус обновлен', 'success');
            } else {
                throw new Error('Update failed');
            }
        } catch (error) {
            console.error('❌ Error updating status:', error);
            window.Animations.showToast('Ошибка обновления статуса', 'error');
            select.value = currentStatus;
        }
    },

    showNotification(message, type = 'info') {
        window.Animations.showToast(message, type);
    },

    // View complaint details with comments (redirect to index.html)
    async viewDetails(complaintId) {
        // Simple approach: open index.html and trigger detail modal
        // Store complaintId in sessionStorage and redirect
        sessionStorage.setItem('openComplaintDetail', complaintId);
        window.location.href = `index.html`;
    }
};

// Initialize admin panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AdminPanel.init();
});
