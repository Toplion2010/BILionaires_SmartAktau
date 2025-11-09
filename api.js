// API module for managing complaints with Supabase
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

const API = {
    supabase: null,
    STORAGE_KEY: 'smartaktau_complaints',
    BUCKET_NAME: 'uploads',

    // Initialize Supabase client
    initSupabase() {
        try {
            if (!window.supabase) {
                console.error('Supabase library not loaded');
                return false;
            }

            this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Error initializing Supabase:', error);
            return false;
        }
    },

    // Generate public ID for complaint (format: ACT-timestamp)
    generatePublicId() {
        const timestamp = Date.now();
        return `ACT-${timestamp}`;
    },

    // Validate image file
    validateImageFile(file) {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!file) {
            return { valid: false, error: 'Файл не выбран' };
        }

        if (!validTypes.includes(file.type)) {
            return {
                valid: false,
                error: 'Недопустимый формат. Используйте JPEG, PNG или WebP'
            };
        }

        if (file.size > maxSize) {
            return {
                valid: false,
                error: 'Размер файла не должен превышать 10MB'
            };
        }

        return { valid: true };
    },

    // Upload photo to Supabase Storage
    async uploadPhoto(file, complaintPublicId) {
        try {
            // Validate file
            const validation = this.validateImageFile(file);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            if (!this.supabase) {
                throw new Error('Supabase не инициализирован');
            }

            // Generate unique filename
            const timestamp = Date.now();
            const fileExt = file.name.split('.').pop();
            const fileName = `${timestamp}_${file.name}`;
            const filePath = `${complaintPublicId}/${fileName}`;

            // Upload to Supabase Storage
            console.log(`📤 Uploading photo: ${filePath}`);
            const { data, error } = await this.supabase.storage
                .from(this.BUCKET_NAME)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                throw error;
            }

            // Get public URL
            const { data: publicUrlData } = this.supabase.storage
                .from(this.BUCKET_NAME)
                .getPublicUrl(filePath);

            console.log('✅ Photo uploaded successfully:', publicUrlData.publicUrl);
            return publicUrlData.publicUrl;

        } catch (error) {
            console.error('❌ Error uploading photo:', error);
            throw new Error(`Ошибка загрузки фото: ${error.message}`);
        }
    },

    // Create new complaint in Supabase
    async createComplaint(payload, file = null) {
        try {
            // Generate public ID
            const publicId = this.generatePublicId();

            // Upload photo if provided
            let photoUrl = null;
            if (file) {
                photoUrl = await this.uploadPhoto(file, publicId);
            }

            // Prepare complaint data
            const complaintData = {
                public_id: publicId,
                title: payload.title,
                description: payload.description,
                category: payload.category,
                status: 'Получено',
                lat: payload.latitude,
                lon: payload.longitude,
                address: 'Актау', // Can be enhanced with reverse geocoding
                photo_urls: photoUrl ? [photoUrl] : null
            };

            // Insert into Supabase
            if (this.supabase) {
                console.log('📝 Creating complaint in Supabase...');
                const { data, error } = await this.supabase
                    .from('complaints')
                    .insert([complaintData])
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                console.log('✅ Complaint created in Supabase:', data);

                // Also save to localStorage as backup
                this.saveToLocalStorage(data);

                return data;
            } else {
                // Fallback to localStorage only
                console.warn('⚠️ Supabase unavailable, using localStorage only');
                return this.saveComplaintLocally(complaintData);
            }

        } catch (error) {
            console.error('❌ Error creating complaint:', error);

            // Fallback to localStorage
            console.warn('⚠️ Falling back to localStorage');
            return this.saveComplaintLocally({
                ...payload,
                public_id: this.generatePublicId(),
                status: 'Получено'
            });
        }
    },

    // Get all complaints from Supabase
    async getComplaints() {
        try {
            if (this.supabase) {
                const { data, error } = await this.supabase
                    .from('complaints')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (error) {
                    throw error;
                }

                console.log(`✅ Loaded ${data.length} complaints from Supabase`);

                // Sync to localStorage
                data.forEach(complaint => this.saveToLocalStorage(complaint));

                return data;
            } else {
                // Fallback to localStorage
                return this.getComplaintsLocally();
            }

        } catch (error) {
            console.error('❌ Error loading complaints from Supabase:', error);
            console.warn('⚠️ Falling back to localStorage');
            return this.getComplaintsLocally();
        }
    },

    // Update complaint status
    async updateStatus(id, newStatus) {
        try {
            if (this.supabase) {
                const { data, error } = await this.supabase
                    .from('complaints')
                    .update({
                        status: newStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id)
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                console.log('✅ Status updated:', data);

                // Update localStorage
                this.updateLocalStorageStatus(id, newStatus);

                return data;
            } else {
                return this.updateLocalStorageStatus(id, newStatus);
            }

        } catch (error) {
            console.error('❌ Error updating status:', error);
            return this.updateLocalStorageStatus(id, newStatus);
        }
    },

    // Delete complaint
    async deleteComplaint(id) {
        try {
            if (this.supabase) {
                const { error } = await this.supabase
                    .from('complaints')
                    .delete()
                    .eq('id', id);

                if (error) {
                    throw error;
                }

                console.log('✅ Complaint deleted from Supabase');
            }

            // Also delete from localStorage
            this.deleteFromLocalStorage(id);
            return true;

        } catch (error) {
            console.error('❌ Error deleting complaint:', error);
            return false;
        }
    },

    // === LocalStorage Fallback Functions ===

    saveComplaintLocally(complaint) {
        try {
            const complaints = this.getComplaintsLocally();
            const newComplaint = {
                id: this.generateLocalId(),
                ...complaint,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            complaints.unshift(newComplaint);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(complaints));

            console.log('✅ Complaint saved to localStorage');
            return newComplaint;
        } catch (error) {
            console.error('❌ Error saving to localStorage:', error);
            throw error;
        }
    },

    getComplaintsLocally() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Error loading from localStorage:', error);
            return [];
        }
    },

    saveToLocalStorage(complaint) {
        try {
            const complaints = this.getComplaintsLocally();
            const index = complaints.findIndex(c =>
                c.id === complaint.id || c.public_id === complaint.public_id
            );

            if (index !== -1) {
                complaints[index] = complaint;
            } else {
                complaints.unshift(complaint);
            }

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(complaints));
        } catch (error) {
            console.error('❌ Error syncing to localStorage:', error);
        }
    },

    updateLocalStorageStatus(id, status) {
        try {
            const complaints = this.getComplaintsLocally();
            const index = complaints.findIndex(c => c.id === id);

            if (index !== -1) {
                complaints[index].status = status;
                complaints[index].updated_at = new Date().toISOString();
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(complaints));
                return complaints[index];
            }

            return null;
        } catch (error) {
            console.error('❌ Error updating localStorage:', error);
            throw error;
        }
    },

    deleteFromLocalStorage(id) {
        try {
            const complaints = this.getComplaintsLocally();
            const filtered = complaints.filter(c => c.id !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
        } catch (error) {
            console.error('❌ Error deleting from localStorage:', error);
        }
    },

    generateLocalId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Clear all (for testing)
    clearAll() {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('🗑️ localStorage cleared');
    },

    // === Comments Functions ===

    // Get comments for a complaint
    async getComments(complaintId) {
        try {
            if (this.supabase) {
                const { data, error } = await this.supabase
                    .from('comments')
                    .select('*')
                    .eq('complaint_id', complaintId)
                    .order('created_at', { ascending: true });

                if (error) {
                    throw error;
                }

                console.log(`✅ Loaded ${data.length} comments for complaint ${complaintId}`);
                return data;
            } else {
                // Fallback to localStorage
                return this.getCommentsLocally(complaintId);
            }

        } catch (error) {
            console.error('❌ Error loading comments:', error);
            return this.getCommentsLocally(complaintId);
        }
    },

    // Create a new comment
    async createComment(complaintId, author, text, authorRole = 'user') {
        try {
            const commentData = {
                complaint_id: complaintId,
                author: author,
                author_role: authorRole,
                text: text
            };

            if (this.supabase) {
                console.log('📝 Creating comment in Supabase...');
                const { data, error } = await this.supabase
                    .from('comments')
                    .insert([commentData])
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                console.log('✅ Comment created:', data);
                return data;
            } else {
                return this.saveCommentLocally(commentData);
            }

        } catch (error) {
            console.error('❌ Error creating comment:', error);
            return this.saveCommentLocally({
                ...commentData,
                id: this.generateLocalId()
            });
        }
    },

    // Update a comment
    async updateComment(id, text) {
        try {
            if (this.supabase) {
                const { data, error } = await this.supabase
                    .from('comments')
                    .update({ text, updated_at: new Date().toISOString() })
                    .eq('id', id)
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                console.log('✅ Comment updated:', data);
                return data;
            } else {
                return this.updateCommentLocally(id, text);
            }

        } catch (error) {
            console.error('❌ Error updating comment:', error);
            return null;
        }
    },

    // Delete a comment
    async deleteComment(id) {
        try {
            if (this.supabase) {
                const { error } = await this.supabase
                    .from('comments')
                    .delete()
                    .eq('id', id);

                if (error) {
                    throw error;
                }

                console.log('✅ Comment deleted');
                return true;
            } else {
                return this.deleteCommentLocally(id);
            }

        } catch (error) {
            console.error('❌ Error deleting comment:', error);
            return false;
        }
    },

    // === LocalStorage Comments Functions ===

    getCommentsLocally(complaintId) {
        try {
            const data = localStorage.getItem('smartaktau_comments');
            const comments = data ? JSON.parse(data) : [];
            return comments.filter(c => c.complaint_id === complaintId);
        } catch (error) {
            console.error('❌ Error loading comments from localStorage:', error);
            return [];
        }
    },

    saveCommentLocally(comment) {
        try {
            const data = localStorage.getItem('smartaktau_comments');
            const comments = data ? JSON.parse(data) : [];

            const newComment = {
                id: this.generateLocalId(),
                ...comment,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            comments.push(newComment);
            localStorage.setItem('smartaktau_comments', JSON.stringify(comments));

            console.log('✅ Comment saved to localStorage');
            return newComment;
        } catch (error) {
            console.error('❌ Error saving comment to localStorage:', error);
            throw error;
        }
    },

    updateCommentLocally(id, text) {
        try {
            const data = localStorage.getItem('smartaktau_comments');
            const comments = data ? JSON.parse(data) : [];
            const index = comments.findIndex(c => c.id === id);

            if (index !== -1) {
                comments[index].text = text;
                comments[index].updated_at = new Date().toISOString();
                localStorage.setItem('smartaktau_comments', JSON.stringify(comments));
                return comments[index];
            }

            return null;
        } catch (error) {
            console.error('❌ Error updating comment in localStorage:', error);
            return null;
        }
    },

    deleteCommentLocally(id) {
        try {
            const data = localStorage.getItem('smartaktau_comments');
            const comments = data ? JSON.parse(data) : [];
            const filtered = comments.filter(c => c.id !== id);
            localStorage.setItem('smartaktau_comments', JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('❌ Error deleting comment from localStorage:', error);
            return false;
        }
    }
};

// Export API globally for compatibility with existing code
window.API = API;

export default API;
