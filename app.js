// Main application logic
import API from './api.js';
import MapModule from './map.js';

const App = {
    // Initialize application
    async init() {
        console.log('🏙️ SmartAktau initializing...');

        // Initialize Supabase
        API.initSupabase();

        // Initialize map
        MapModule.init();

        // Setup event listeners
        this.setupEventListeners();

        // Load and display complaints
        await this.loadComplaints();

        // Check if should open detail modal (from admin panel)
        const openDetailId = sessionStorage.getItem('openComplaintDetail');
        if (openDetailId) {
            sessionStorage.removeItem('openComplaintDetail');
            // Wait a bit for complaints to load
            setTimeout(() => {
                this.openDetailModal(parseInt(openDetailId));
            }, 500);
        }

        console.log('✅ SmartAktau ready!');
    },

    // Setup all event listeners
    setupEventListeners() {
        // Modal controls
        const newComplaintBtn = document.getElementById('newComplaintBtn');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const modalOverlay = document.querySelector('.modal-overlay');

        newComplaintBtn.addEventListener('click', () => this.openModal());
        closeModalBtn.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        modalOverlay.addEventListener('click', () => this.closeModal());

        // Form submission
        const complaintForm = document.getElementById('complaintForm');
        complaintForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Character counter for description
        const descriptionField = document.getElementById('description');
        const charCounter = document.querySelector('.char-counter');
        descriptionField.addEventListener('input', (e) => {
            charCounter.textContent = `${e.target.value.length}/500`;
        });

        // Photo preview
        const photoInput = document.getElementById('photo');
        photoInput.addEventListener('change', (e) => this.handlePhotoUpload(e));

        // Geolocation button
        const getLocationBtn = document.getElementById('getLocationBtn');
        getLocationBtn.addEventListener('click', () => this.handleGeolocation());
    },

    // Open modal
    openModal() {
        const modal = document.getElementById('complaintModal');
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent body scroll
    },

    // Close modal
    closeModal() {
        const modal = document.getElementById('complaintModal');
        modal.classList.add('hidden');
        document.body.style.overflow = ''; // Restore body scroll

        // Reset form and clear temp marker
        this.resetForm();
        MapModule.clearTempMarker();
    },

    // Reset form
    resetForm() {
        const form = document.getElementById('complaintForm');
        form.reset();

        // Reset location status
        const locationStatus = document.getElementById('locationStatusText');
        locationStatus.textContent = '📍 Нажмите на карту или используйте кнопку выше';
        locationStatus.classList.remove('selected');

        // Reset address field
        const addressField = document.getElementById('address');
        if (addressField) addressField.value = '';

        // Reset char counter
        const charCounter = document.querySelector('.char-counter');
        charCounter.textContent = '0/500';

        // Hide photo preview
        const photoPreview = document.getElementById('photoPreview');
        photoPreview.classList.add('hidden');
        photoPreview.innerHTML = '';
    },

    // Handle photo upload
    handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validate using API validation
        const validation = API.validateImageFile(file);
        if (!validation.valid) {
            window.Animations.showToast(validation.error, 'error');
            e.target.value = '';
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (event) => {
            const photoPreview = document.getElementById('photoPreview');
            photoPreview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
            photoPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    },

    // Handle form submission
    async handleFormSubmit(e) {
        e.preventDefault();

        // Get form data
        const formData = new FormData(e.target);
        const title = formData.get('title');
        const category = formData.get('category');
        const description = formData.get('description');
        const latitude = parseFloat(formData.get('latitude'));
        const longitude = parseFloat(formData.get('longitude'));

        // Validate location
        if (!latitude || !longitude) {
            window.Animations.showToast('Пожалуйста, выберите местоположение на карте', 'warning');
            window.Animations.shake(document.getElementById('locationStatusText').parentElement);
            return;
        }

        // Get photo file (not base64)
        const photoInput = document.getElementById('photo');
        const photoFile = photoInput.files[0] || null;

        // Create complaint object
        const complaintPayload = {
            title,
            category,
            description,
            latitude,
            longitude
        };

        // Show loading overlay
        window.Animations.showLoading('Отправка обращения...');

        // Disable submit button to prevent double submission
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';

        try {
            // Create complaint (will upload photo to Supabase if provided)
            console.log('📤 Submitting complaint...');
            const savedComplaint = await API.createComplaint(complaintPayload, photoFile);
            console.log('✅ Complaint saved:', savedComplaint);

            // Add to map
            MapModule.addComplaintMarker(savedComplaint);

            // Add to feed
            this.addComplaintToFeed(savedComplaint);

            // Close modal and reset form
            this.closeModal();

            // Show success message
            this.showNotification('✅ Обращение успешно отправлено!', 'success');
        } catch (error) {
            console.error('❌ Error saving complaint:', error);
            this.showNotification('❌ Ошибка при сохранении. Попробуйте снова.', 'error');
        } finally {
            // Hide loading overlay
            window.Animations.hideLoading();
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить';
        }
    },

    // Load all complaints
    async loadComplaints() {
        window.Animations.showLoading('Загрузка обращений...');
        try {
            console.log('📥 Loading complaints...');
            const complaints = await API.getComplaints();

            if (complaints.length === 0) {
                this.showEmptyState();
                return;
            }

            // Add to map
            complaints.forEach(complaint => {
                MapModule.addComplaintMarker(complaint);
            });

            // Add to feed
            this.renderFeed(complaints);
        } catch (error) {
            console.error('❌ Error loading complaints:', error);
            this.showEmptyState();
        } finally {
            window.Animations.hideLoading();
        }
    },

    // Render complaints feed
    renderFeed(complaints) {
        const feed = document.getElementById('complaintsFeed');

        if (complaints.length === 0) {
            this.showEmptyState();
            return;
        }

        feed.innerHTML = complaints.map(complaint => this.createComplaintCard(complaint)).join('');
    },

    // Add single complaint to feed (prepend)
    addComplaintToFeed(complaint) {
        const feed = document.getElementById('complaintsFeed');

        // Remove empty state if exists
        const emptyState = feed.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Add new complaint at the beginning
        feed.insertAdjacentHTML('afterbegin', this.createComplaintCard(complaint));
    },

    // Create complaint card HTML
    createComplaintCard(complaint) {
        // Support both old (createdAt) and new (created_at) field names
        const id = complaint.id;
        const title = complaint.title;
        const category = complaint.category;
        const description = complaint.description;
        const status = complaint.status || 'Получено';
        const createdAt = complaint.created_at || complaint.createdAt;
        const commentsCount = complaint.comments_count || 0;

        const date = new Date(createdAt).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        const categoryIcon = MapModule.getCategoryIcon(category);
        const categoryName = MapModule.getCategoryName(category);
        const statusClass = this.getStatusClass(status);

        const commentsHtml = commentsCount > 0
            ? `<span class="comment-count">💬 ${commentsCount}</span>`
            : '';

        return `
            <div class="complaint-card" data-id="${id}" onclick="App.openDetailModal(${id})">
                <div class="complaint-header">
                    <h3 class="complaint-title">${title}</h3>
                    <span class="complaint-status ${statusClass}">${status}</span>
                </div>
                <div class="complaint-category">${categoryIcon} ${categoryName}</div>
                <p class="complaint-description">${description}</p>
                <div class="complaint-footer">
                    <span>📅 ${date}</span>
                    <span>📍 Актау</span>
                    ${commentsHtml}
                </div>
            </div>
        `;
    },

    // Get status class for styling
    getStatusClass(status) {
        const statusMap = {
            'Получено': 'status-new',
            'В обработке': 'status-processing',
            'Выполнено': 'status-completed',
            'new': 'status-new',
            'processing': 'status-processing',
            'completed': 'status-completed'
        };
        return statusMap[status] || 'status-new';
    },

    // Show empty state
    showEmptyState() {
        const feed = document.getElementById('complaintsFeed');
        feed.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p class="empty-state-text">Пока нет обращений</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Нажмите "Сообщить о проблеме", чтобы создать первое обращение</p>
            </div>
        `;
    },

    // Show notification
    showNotification(message, type = 'info') {
        window.Animations.showToast(message, type);
    },

    // === Comments & Detail Modal ===

    currentComplaint: null,

    // Open complaint detail modal
    async openDetailModal(complaintId) {
        window.Animations.showLoading('Загрузка деталей...');
        try {
            // Find complaint
            const complaints = await API.getComplaints();
            const complaint = complaints.find(c => c.id === complaintId);

            if (!complaint) {
                window.Animations.showToast('Жалоба не найдена', 'error');
                return;
            }

            this.currentComplaint = complaint;

            // Render complaint info
            this.renderComplaintDetail(complaint);

            // Load and render comments
            await this.loadComments(complaintId);

            // Show modal
            const modal = document.getElementById('complaintDetailModal');
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';

            // Setup comment form submit
            const commentForm = document.getElementById('commentForm');
            commentForm.onsubmit = (e) => this.handleCommentSubmit(e);

            // Setup close button
            const closeBtn = document.getElementById('closeDetailModalBtn');
            closeBtn.onclick = () => this.closeDetailModal();

        } catch (error) {
            console.error('Error opening detail modal:', error);
            window.Animations.showToast('Ошибка загрузки деталей', 'error');
        } finally {
            window.Animations.hideLoading();
        }
    },

    // Close detail modal
    closeDetailModal() {
        const modal = document.getElementById('complaintDetailModal');
        modal.classList.add('hidden');
        document.body.style.overflow = '';

        // Reset form
        const commentForm = document.getElementById('commentForm');
        commentForm.reset();

        this.currentComplaint = null;
    },

    // Render complaint detail
    renderComplaintDetail(complaint) {
        const { title, category, description, status, lat, lon, photo_urls, created_at, public_id } = complaint;
        const date = new Date(created_at || complaint.createdAt).toLocaleString('ru-RU');

        const categoryName = MapModule.getCategoryName(category);
        const photoHtml = photo_urls && photo_urls.length > 0
            ? `<div class="detail-row">
                   <div class="detail-label">Фото:</div>
                   <div class="detail-value">
                       <img src="${photo_urls[0]}" class="detail-photo" alt="Photo" onclick="window.open('${photo_urls[0]}', '_blank')">
                   </div>
               </div>`
            : '';

        const html = `
            <div class="complaint-detail-info">
                <div class="detail-row">
                    <div class="detail-label">ID:</div>
                    <div class="detail-value"><code>${public_id || complaint.id}</code></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Заголовок:</div>
                    <div class="detail-value"><strong>${title}</strong></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Категория:</div>
                    <div class="detail-value">${categoryName}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Статус:</div>
                    <div class="detail-value">
                        <span class="complaint-status ${this.getStatusClass(status)}">${status}</span>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Описание:</div>
                    <div class="detail-value">${description}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Дата:</div>
                    <div class="detail-value">${date}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Координаты:</div>
                    <div class="detail-value">${lat?.toFixed(5)}, ${lon?.toFixed(5)}</div>
                </div>
                ${photoHtml}
            </div>
        `;

        document.getElementById('complaintInfo').innerHTML = html;
    },

    // Load comments
    async loadComments(complaintId) {
        try {
            const comments = await API.getComments(complaintId);
            this.renderComments(comments);
        } catch (error) {
            console.error('Error loading comments:', error);
            this.renderComments([]);
        }
    },

    // Render comments
    renderComments(comments) {
        const container = document.getElementById('commentsList');

        if (comments.length === 0) {
            container.innerHTML = '<div class="comments-empty">Пока нет комментариев. Будьте первым!</div>';
            return;
        }

        container.innerHTML = comments.map(comment => this.createCommentHTML(comment)).join('');
    },

    // Create comment HTML
    createCommentHTML(comment) {
        const { author, author_role, text, created_at } = comment;
        const date = new Date(created_at).toLocaleString('ru-RU', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });

        const roleClass = author_role || 'user';
        const roleName = {
            'user': 'Житель',
            'admin': 'Администрация',
            'service': 'Служба'
        }[roleClass] || 'Житель';

        return `
            <div class="comment ${roleClass}">
                <div class="comment-header">
                    <div class="comment-author">
                        ${author}
                        <span class="author-badge ${roleClass}">${roleName}</span>
                    </div>
                    <div class="comment-date">${date}</div>
                </div>
                <div class="comment-text">${text}</div>
            </div>
        `;
    },

    // Handle comment submit
    async handleCommentSubmit(e) {
        e.preventDefault();

        if (!this.currentComplaint) {
            window.Animations.showToast('Ошибка: жалоба не выбрана', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const author = formData.get('commentAuthor');
        const text = formData.get('commentText');

        try {
            console.log('💬 Submitting comment...');
            const comment = await API.createComment(
                this.currentComplaint.id,
                author,
                text,
                'user'
            );

            console.log('✅ Comment created:', comment);

            // Reload comments
            await this.loadComments(this.currentComplaint.id);

            // Reset form
            e.target.reset();

            // Show success
            this.showNotification('✅ Комментарий добавлен!', 'success');

        } catch (error) {
            console.error('❌ Error creating comment:', error);
            this.showNotification('❌ Ошибка при добавлении комментария', 'error');
        }
    },

    // === Geolocation ===

    // Handle geolocation button click
    async handleGeolocation() {
        const locationStatus = document.getElementById('locationStatusText');
        const latInput = document.getElementById('latitude');
        const lonInput = document.getElementById('longitude');
        const addressInput = document.getElementById('address');
        const getLocationBtn = document.getElementById('getLocationBtn');

        // Check if Geolocation API is supported
        if (!navigator.geolocation) {
            window.Animations.showToast('Геолокация не поддерживается вашим браузером', 'error');
            locationStatus.textContent = '❌ Геолокация недоступна';
            return;
        }

        // Update status and disable button
        locationStatus.textContent = '🔍 Определяем местоположение…';
        locationStatus.classList.remove('selected');
        getLocationBtn.disabled = true;
        getLocationBtn.textContent = '🔍 Определяем...';

        try {
            // Request current position
            navigator.geolocation.getCurrentPosition(
                // Success callback
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const accuracy = position.coords.accuracy;

                    console.log('📍 Geolocation success:', { lat, lon, accuracy });

                    // Update form fields
                    latInput.value = lat;
                    lonInput.value = lon;

                    // Update status with coordinates
                    locationStatus.textContent = `✅ Координаты: ${lat.toFixed(5)}, ${lon.toFixed(5)} (±${Math.round(accuracy)}м)`;
                    locationStatus.classList.add('selected');

                    // Show success toast
                    window.Animations.showToast('Местоположение определено!', 'success');

                    // Update map marker
                    MapModule.onLocationSelect(lat, lon);

                    // Try to get address via reverse geocoding (Nominatim)
                    try {
                        locationStatus.textContent = `✅ Координаты получены. Определяем адрес…`;

                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=ru`,
                            {
                                headers: {
                                    'User-Agent': 'SmartAktau/1.0'
                                }
                            }
                        );

                        if (response.ok) {
                            const data = await response.json();
                            if (data.display_name) {
                                addressInput.value = data.display_name;
                                locationStatus.textContent = `✅ ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
                                console.log('📍 Address:', data.display_name);
                            }
                        } else {
                            console.warn('Reverse geocoding failed:', response.status);
                        }
                    } catch (geocodeError) {
                        console.warn('Reverse geocoding error:', geocodeError);
                        // Not critical - just skip address lookup
                    }

                    // Re-enable button
                    getLocationBtn.disabled = false;
                    getLocationBtn.textContent = '📍 Определить моё местоположение';
                },
                // Error callback
                (error) => {
                    console.error('Geolocation error:', error);

                    let errorMessage = 'Не удалось определить местоположение';

                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Доступ к геолокации заблокирован. Разрешите доступ в настройках браузера.';
                            locationStatus.textContent = '❌ Доступ запрещен';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Информация о местоположении недоступна';
                            locationStatus.textContent = '❌ Местоположение недоступно';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Таймаут определения местоположения. Попробуйте ещё раз.';
                            locationStatus.textContent = '❌ Таймаут';
                            break;
                        default:
                            locationStatus.textContent = '❌ Ошибка';
                            break;
                    }

                    window.Animations.showToast(errorMessage, 'error');
                    window.Animations.shake(getLocationBtn);

                    // Re-enable button
                    getLocationBtn.disabled = false;
                    getLocationBtn.textContent = '📍 Определить моё местоположение';
                },
                // Options
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } catch (error) {
            console.error('Unexpected geolocation error:', error);
            window.Animations.showToast('Ошибка при попытке получить местоположение', 'error');
            locationStatus.textContent = '❌ Ошибка';
            getLocationBtn.disabled = false;
            getLocationBtn.textContent = '📍 Определить моё местоположение';
        }
    }
};

// Export App globally for debugging
window.App = App;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
