class TaskManager {
    constructor() {
        this.tasks = this.loadTasks();
        this.nextId = this.getNextId();
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderTasks();
        this.updateStats();
    }

    bindEvents() {
        const taskForm = document.getElementById('taskForm');
        taskForm.addEventListener('submit', (e) => this.handleTaskSubmit(e));

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilter(e));
        });

        // Clear day button
        document.getElementById('clearDay').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all tasks for today?')) {
                this.clearAllTasks();
            }
        });

        // Export button
        document.getElementById('exportDay').addEventListener('click', () => {
            this.exportDay();
        });
    }

    generateId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getNextId() {
        const ids = this.tasks.map(task => {
            const match = task.id.match(/task_\d+_/);
            return match ? parseInt(match[0].split('_')[1]) : 0;
        });
        return Math.max(...ids, Date.now()) + 1;
    }

    createTask(data) {
        const task = {
            id: this.generateId(),
            title: data.title.trim(),
            description: data.description?.trim() || '',
            priority: data.priority || 'medium',
            time: data.time || null,
            duration: parseInt(data.duration) || 30,
            completed: false,
            scheduled: false,
            timeSlot: null,
            createdAt: new Date().toISOString(),
            ...data
        };

        this.tasks.push(task);
        this.saveTasks();
        return task;
    }

    updateTask(id, updates) {
        const taskIndex = this.tasks.findIndex(task => task.id === id);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
            this.saveTasks();
            return this.tasks[taskIndex];
        }
        return null;
    }

    deleteTask(id) {
        const taskIndex = this.tasks.findIndex(task => task.id === id);
        if (taskIndex !== -1) {
            const deletedTask = this.tasks.splice(taskIndex, 1)[0];
            this.saveTasks();
            return deletedTask;
        }
        return null;
    }

    toggleTaskComplete(id) {
        const task = this.updateTask(id, {
            completed: !this.getTask(id)?.completed
        });
        if (task) {
            this.updateStats();
            this.showToast(
                task.completed ? 'Task completed! 🎉' : 'Task marked as incomplete',
                task.completed ? 'success' : 'info'
            );
        }
        return task;
    }

    getTask(id) {
        return this.tasks.find(task => task.id === id);
    }

    getTasks(filter = {}) {
        let filteredTasks = [...this.tasks];

        if (filter.priority && filter.priority !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.priority === filter.priority);
        }

        if (filter.completed !== undefined) {
            filteredTasks = filteredTasks.filter(task => task.completed === filter.completed);
        }

        if (filter.scheduled !== undefined) {
            filteredTasks = filteredTasks.filter(task => task.scheduled === filter.scheduled);
        }

        return filteredTasks;
    }

    handleTaskSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const taskData = {
            title: formData.get('title') || document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            priority: document.getElementById('taskPriority').value,
            time: document.getElementById('taskTime').value,
            duration: document.getElementById('taskDuration').value
        };

        if (!taskData.title.trim()) {
            this.showToast('Please enter a task title', 'error');
            return;
        }

        const task = this.createTask(taskData);
        this.renderTasks();
        this.updateStats();
        
        // Reset form
        e.target.reset();
        document.getElementById('taskTitle').focus();
        
        this.showToast('Task added successfully! 📝', 'success');
    }

    handleFilter(e) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        const priority = e.target.dataset.priority;
        this.renderTasks({ priority });
    }

    renderTasks(filter = {}) {
        const taskPool = document.getElementById('taskPool');
        const unscheduledTasks = this.getTasks({ ...filter, scheduled: false });

        taskPool.innerHTML = '';

        if (unscheduledTasks.length === 0) {
            taskPool.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <p>No unscheduled tasks</p>
                    <small>All tasks are scheduled or add a new one!</small>
                </div>
            `;
            return;
        }

        unscheduledTasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            taskPool.appendChild(taskElement);
        });

        // Re-initialize drag and drop for new elements
        if (window.dragDropManager) {
            window.dragDropManager.initTaskPool();
        }
    }

    createTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.className = `task-card ${task.completed ? 'completed' : ''}`;
        taskElement.dataset.taskId = task.id;
        taskElement.dataset.priority = task.priority;

        const timeDisplay = task.time ? 
            `<span class="task-time"><i class="fas fa-clock"></i> ${this.formatTime(task.time)}</span>` : 
            `<span class="task-time"><i class="fas fa-hourglass-half"></i> ${task.duration}min</span>`;

        taskElement.innerHTML = `
            <div class="task-header">
                <div class="task-title">${this.escapeHtml(task.title)}</div>
                <div class="task-actions">
                    <button class="task-action" onclick="taskManager.toggleTaskComplete('${task.id}')" title="Toggle Complete">
                        <i class="fas fa-${task.completed ? 'undo' : 'check'}"></i>
                    </button>
                    <button class="task-action" onclick="taskManager.editTask('${task.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="task-action" onclick="taskManager.deleteTaskConfirm('${task.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
            <div class="task-meta">
                <span class="task-priority ${task.priority}">${task.priority}</span>
                ${timeDisplay}
            </div>
        `;

        return taskElement;
    }

    editTask(id) {
        // This method is now handled by DragDropManager's showInlineEditor
        // for scheduled tasks, but we keep it for unscheduled tasks
        const task = this.getTask(id);
        if (!task) return;

        // Simple inline editing for unscheduled tasks
        const taskElement = document.querySelector(`[data-task-id="${id}"]`);
        if (!taskElement) return;

        // Create inline editor
        const editor = document.createElement('div');
        editor.className = 'task-inline-editor';
        editor.innerHTML = `
            <input type="text" class="edit-title" value="${this.escapeHtml(task.title)}" placeholder="Task title">
            <textarea class="edit-description" placeholder="Task description">${this.escapeHtml(task.description || '')}</textarea>
            <div class="edit-options">
                <select class="edit-priority">
                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                    <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                </select>
                <input type="number" class="edit-duration" value="${task.duration}" min="15" max="480" step="15">
                <div class="edit-actions">
                    <button class="save-edit">Save</button>
                    <button class="cancel-edit">Cancel</button>
                </div>
            </div>
        `;

        // Store original content
        const originalContent = taskElement.innerHTML;
        taskElement.innerHTML = '';
        taskElement.appendChild(editor);

        // Focus title input
        const titleInput = editor.querySelector('.edit-title');
        titleInput.focus();
        titleInput.select();

        // Save handler
        editor.querySelector('.save-edit').addEventListener('click', () => {
            const updates = {
                title: editor.querySelector('.edit-title').value.trim(),
                description: editor.querySelector('.edit-description').value.trim(),
                priority: editor.querySelector('.edit-priority').value,
                duration: parseInt(editor.querySelector('.edit-duration').value)
            };

            if (!updates.title) {
                this.showToast('Task title cannot be empty', 'error');
                return;
            }

            this.updateTask(id, updates);
            taskElement.innerHTML = originalContent;
            this.renderTasks();
            this.showToast('Task updated successfully', 'success');
        });

        // Cancel handler
        editor.querySelector('.cancel-edit').addEventListener('click', () => {
            taskElement.innerHTML = originalContent;
        });

        // Handle escape key
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                taskElement.innerHTML = originalContent;
            }
        });
    }

    deleteTaskConfirm(id) {
        const task = this.getTask(id);
        if (!task) return;

        if (confirm(`Delete task: "${task.title}"?`)) {
            this.deleteTask(id);
            this.renderTasks();
            this.updateStats();
            this.showToast('Task deleted', 'info');
        }
    }

    clearAllTasks() {
        this.tasks = [];
        this.saveTasks();
        this.renderTasks();
        this.updateStats();
        this.showToast('All tasks cleared', 'info');
    }

    updateStats() {
        const completedTasks = this.tasks.filter(task => task.completed).length;
        const totalTasks = this.tasks.length;
        const remainingTasks = totalTasks - completedTasks;
        const focusTime = this.calculateFocusTime();

        document.getElementById('completedTasks').textContent = completedTasks;
        document.getElementById('remainingTasks').textContent = remainingTasks;
        document.getElementById('focusTime').textContent = `${Math.round(focusTime / 60)}h`;
        
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        document.getElementById('progressPercentage').textContent = `${progressPercentage}%`;

        // Update charts
        if (window.chartManager) {
            window.chartManager.updateProgressChart(progressPercentage);
            window.chartManager.updatePriorityChart(this.getPriorityStats());
        }

        this.updateMotivationalMessage(progressPercentage, completedTasks);
    }

    calculateFocusTime() {
        return this.tasks.reduce((total, task) => {
            return total + (task.duration || 30);
        }, 0);
    }

    getPriorityStats() {
        const stats = { high: 0, medium: 0, low: 0 };
        this.tasks.forEach(task => {
            stats[task.priority] = (stats[task.priority] || 0) + 1;
        });
        return stats;
    }

    updateMotivationalMessage(progress, completed) {
        const messageEl = document.getElementById('motivationalMessage');
        let message = '';
        let icon = 'fas fa-star';

        if (progress === 100) {
            message = "🎉 Amazing! You've completed all your tasks!";
            icon = 'fas fa-trophy';
        } else if (progress >= 75) {
            message = "🔥 You're on fire! Almost there!";
            icon = 'fas fa-fire';
        } else if (progress >= 50) {
            message = "💪 Great progress! Keep it up!";
            icon = 'fas fa-thumbs-up';
        } else if (progress >= 25) {
            message = "🌟 Good start! You've got this!";
            icon = 'fas fa-star';
        } else if (completed > 0) {
            message = "✨ Every step counts! Keep going!";
            icon = 'fas fa-heart';
        } else {
            message = "🚀 Ready to make today amazing!";
            icon = 'fas fa-rocket';
        }

        messageEl.innerHTML = `
            <i class="${icon}"></i>
            <p>${message}</p>
        `;
    }

    exportDay() {
        const today = new Date().toISOString().split('T')[0];
        const exportData = {
            date: today,
            tasks: this.tasks,
            stats: {
                total: this.tasks.length,
                completed: this.tasks.filter(t => t.completed).length,
                byPriority: this.getPriorityStats()
            }
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `daily-docket-${today}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Daily plan exported!', 'success');
    }

    saveTasks() {
        try {
            localStorage.setItem('dailyDocketTasks', JSON.stringify(this.tasks));
        } catch (error) {
            console.error('Failed to save tasks:', error);
            this.showToast('Failed to save tasks', 'error');
        }
    }

    loadTasks() {
        try {
            const saved = localStorage.getItem('dailyDocketTasks');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Failed to load tasks:', error);
            return [];
        }
    }

    formatTime(timeString) {
        const [hours, minutes] = timeString.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes));
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger show animation
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
}

// Initialize task manager
window.taskManager = new TaskManager();