// Animation utilities and toast notifications

const Animations = {
    // Show loading overlay
    showLoading(message = 'Загрузка...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.querySelector('.loading-text').textContent = message;
            overlay.classList.remove('hidden');
        }
    },

    // Hide loading overlay
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    },

    // Show toast notification
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toastId = `toast-${Date.now()}`;
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const titles = {
            success: 'Успешно',
            error: 'Ошибка',
            warning: 'Внимание',
            info: 'Информация'
        };

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${titles[type]}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="Animations.closeToast('${toastId}')">&times;</button>
        `;

        container.appendChild(toast);

        // Auto-close after duration
        if (duration > 0) {
            setTimeout(() => {
                this.closeToast(toastId);
            }, duration);
        }

        return toastId;
    },

    // Close specific toast
    closeToast(toastId) {
        const toast = document.getElementById(toastId);
        if (!toast) return;

        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    },

    // Close all toasts
    closeAllToasts() {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toasts = container.querySelectorAll('.toast');
        toasts.forEach(toast => {
            toast.classList.add('hiding');
        });

        setTimeout(() => {
            container.innerHTML = '';
        }, 300);
    },

    // Animate element on scroll
    observeScrollAnimations() {
        const elements = document.querySelectorAll('.scroll-reveal');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                }
            });
        }, {
            threshold: 0.1
        });

        elements.forEach(el => observer.observe(el));
    },

    // Add ripple effect to element
    addRipple(event, element) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple-effect');

        element.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    },

    // Shake element (for errors)
    shake(element) {
        element.classList.add('animate-shake');
        setTimeout(() => {
            element.classList.remove('animate-shake');
        }, 500);
    },

    // Pulse element
    pulse(element) {
        element.classList.add('animate-pulse');
        setTimeout(() => {
            element.classList.remove('animate-pulse');
        }, 2000);
    },

    // Bounce element
    bounce(element) {
        element.classList.add('animate-bounce');
        setTimeout(() => {
            element.classList.remove('animate-bounce');
        }, 1000);
    },

    // Fade in element
    fadeIn(element, delay = 0) {
        setTimeout(() => {
            element.style.opacity = '0';
            element.style.display = 'block';
            element.classList.add('animate-fade-in');

            setTimeout(() => {
                element.style.opacity = '1';
            }, 10);
        }, delay);
    },

    // Fade out element
    fadeOut(element, callback) {
        element.style.opacity = '1';
        element.style.transition = 'opacity 0.3s ease';

        setTimeout(() => {
            element.style.opacity = '0';
        }, 10);

        setTimeout(() => {
            element.style.display = 'none';
            if (callback) callback();
        }, 300);
    },

    // Slide in from right
    slideInRight(element, delay = 0) {
        setTimeout(() => {
            element.classList.add('animate-slide-right');
        }, delay);
    },

    // Scale in
    scaleIn(element, delay = 0) {
        setTimeout(() => {
            element.classList.add('animate-scale');
        }, delay);
    },

    // Add stagger animation to children
    staggerChildren(parent, className, delay = 100) {
        const children = parent.children;
        Array.from(children).forEach((child, index) => {
            setTimeout(() => {
                child.classList.add(className);
            }, index * delay);
        });
    }
};

// Export for global access
window.Animations = Animations;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Observe scroll animations
    Animations.observeScrollAnimations();

    // Add ripple effect to all buttons
    document.querySelectorAll('.btn').forEach(btn => {
        if (!btn.classList.contains('no-ripple')) {
            btn.addEventListener('click', function(e) {
                const ripple = document.createElement('span');
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;

                ripple.style.cssText = `
                    position: absolute;
                    width: ${size}px;
                    height: ${size}px;
                    left: ${x}px;
                    top: ${y}px;
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 50%;
                    transform: scale(0);
                    animation: ripple 0.6s ease-out;
                    pointer-events: none;
                `;

                this.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);
            });
        }
    });

    // Add CSS for ripple animation
    if (!document.querySelector('#ripple-style')) {
        const style = document.createElement('style');
        style.id = 'ripple-style';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
});

export default Animations;
