class DragDropManager {    
    constructor(taskManager) {
        this.taskManager = taskManager;
        // Fixed schedule hours - cannot be edited
        this.scheduleHours = Object.freeze({ start: 6, end: 23 });
        this.sortableInstances = new Map();
        this.activeEditors = new Set();
        this.init();
    }

    init() {
        this.initScheduleGrid();
        this.initTaskPool();
        this.loadScheduledTasks();
    }

    initScheduleGrid() {
        // Create time slots first
        this.createTimeSlots();
        
        // Then initialize sortable for each time block
        document.querySelectorAll('.time-block').forEach(block => {
            // Clean up existing sortable instance if it exists
            const existingInstance = this.sortableInstances.get(block);
            if (existingInstance) {
                existingInstance.destroy();
            }

            // Check if Sortable is available
            if (typeof Sortable !== 'undefined') {
                const sortableInstance = new Sortable(block, {
                    group: 'tasks',
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    onAdd: (evt) => this.handleTaskScheduled(evt),
                    onRemove: (evt) => this.handleTaskUnscheduled(evt),
                    onEnd: (evt) => this.handleTaskMoved(evt)
                });
                this.sortableInstances.set(block, sortableInstance);
            } else {
                console.warn('Sortable.js not loaded. Drag and drop functionality will not work.');
            }
        });
    }

    initTaskPool() {
        const taskPool = document.getElementById('taskPool');
        if (!taskPool) {
            console.warn('Task pool element not found');
            return;
        }

        // Clean up existing instance
        if (taskPool.sortableInstance) {
            taskPool.sortableInstance.destroy();
        }

        if (typeof Sortable !== 'undefined') {
            taskPool.sortableInstance = new Sortable(taskPool, {
                group: 'tasks',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                onAdd: (evt) => this.handleTaskUnscheduled(evt),
                onEnd: (evt) => this.handleTaskReordered(evt)
            });
        }
    }    

    createTimeSlots() {
        const scheduleGrid = document.getElementById('scheduleGrid');
        if (!scheduleGrid) {
            console.warn('Schedule grid element not found');
            return;
        }

        scheduleGrid.innerHTML = '';
        
        // Create time slots based on FIXED schedule hours (6 AM to 11 PM)
        for (let hour = this.scheduleHours.start; hour <= this.scheduleHours.end; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            timeLabel.textContent = this.formatHour(hour);
            
            const timeBlock = document.createElement('div');
            timeBlock.className = 'time-block';
            timeBlock.dataset.hour = hour;
            timeBlock.dataset.time = `${hour.toString().padStart(2, '0')}:00`;

            // Bind click handler properly
            this.bindTimeBlockClick(timeBlock);
        
            timeSlot.appendChild(timeLabel);
            timeSlot.appendChild(timeBlock);
            scheduleGrid.appendChild(timeSlot);
        }
    }

    // Method to get current schedule hours (read-only)
    getScheduleHours() {
        return { ...this.scheduleHours }; // Return a copy to prevent modification
    }

    bindTimeBlockClick(timeBlock) {
        // Remove existing click handler if any
        if (timeBlock.clickHandler) {
            timeBlock.removeEventListener('click', timeBlock.clickHandler);
        }
        
        timeBlock.clickHandler = (e) => this.handleTimeBlockClick(e, timeBlock);
        timeBlock.addEventListener('click', timeBlock.clickHandler);
    }

    handleTimeBlockClick(e, timeBlock) {
        // If clicking on task card or its actions, don't show input
        if (e.target.closest('.task-actions') || e.target.closest('.task-action')) {
            return;
        }

        // If there's already a form, don't create another one
        if (timeBlock.querySelector('.time-block-form')) {
            return;
        }                
        
        // Get the existing task if any
        const existingTask = timeBlock.querySelector('.task-card');
        
        // If clicking directly on the task card (not on actions), show editor
        if (existingTask && e.target.closest('.task-card') && !e.target.closest('.task-action')) {
            this.showInlineEditor(existingTask);
            return;
        }

        // If clicking empty space in the time block or on a completed task's block
        if (!existingTask || (existingTask && existingTask.dataset.completed === 'true')) {
            this.showTaskInput(timeBlock);
        }
    }

    showTaskInput(timeBlock) {
        const hour = timeBlock.dataset.hour;
        const time = timeBlock.dataset.time;

        // If there's an existing completed task, hide it temporarily
        const existingTask = timeBlock.querySelector('.task-card');
        if (existingTask && existingTask.dataset.completed === 'true') {
           existingTask.style.display = 'none';
        }

        // Create form element
        const form = document.createElement('div');
        form.className = 'time-block-form';        
        form.innerHTML = `
            <div class="task-input-wrapper">
                <div class="task-input-header">
                    <input type="text" class="task-title" placeholder="Task title" autofocus>
                </div>
                <div class="task-input-content">
                    <div class="quick-options">
                        <div class="option-group">
                            <label>Priority:</label>
                            <select class="task-priority" title="Priority">
                                <option value="low">Low</option>
                                <option value="medium" selected>Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                        <div class="option-group">
                            <label>Duration:</label>
                            <input type="number" class="task-duration" value="30" min="15" max="480" step="15" title="Duration (minutes)">
                            <span class="duration-unit">min</span>
                        </div>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary cancel-task">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button type="button" class="btn-primary save-task">
                        <i class="fas fa-save"></i> Save Task
                    </button>
                </div>
            </div>
        `;

        timeBlock.appendChild(form);
        const titleInput = form.querySelector('.task-title');
        titleInput.focus();

        const saveTask = () => {
            const title = titleInput.value.trim();
            const priority = form.querySelector('.task-priority').value;
            const duration = parseInt(form.querySelector('.task-duration').value) || 30;

            if (!title) {
                this.taskManager.showToast('Please enter a task title', 'error');
                return;
            }

            // Remove any existing completed task
            if (existingTask && existingTask.dataset.completed === 'true') {
              this.taskManager.deleteTask(existingTask.dataset.taskId);
              existingTask.remove();
            }

            // Create task
            const task = this.taskManager.createTask({
                title,
                priority,
                duration,
                scheduled: true,
                timeSlot: hour,
                scheduledTime: time,
                completed: false
            });

            // Create and add task element
            const taskElement = this.createTaskCard(task, timeBlock);
            form.remove();
            timeBlock.appendChild(taskElement);
            timeBlock.classList.add('has-task');
            timeBlock.classList.remove('has-completed-task');

            this.taskManager.showToast('Task created successfully!', 'success');
            this.taskManager.updateStats();
        };

        const cancelTask = () => {
            form.remove();
            // Show the existing task again if it was hidden
            if (existingTask && existingTask.dataset.completed === 'true') {
                existingTask.style.display = '';
         }
        };

        // Use onclick to prevent multiple listeners
        form.querySelector('.save-task').onclick = saveTask;
        form.querySelector('.cancel-task').onclick = cancelTask;

        // Handle keyboard events
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveTask();
            } else if (e.key === 'Escape') {
                cancelTask();
            }
        });

        // Handle click outside
        const handleClickOutside = (e) => {
            if (!form.contains(e.target) && titleInput.value.trim() === '') {
                cancelTask();
                document.removeEventListener('click', handleClickOutside);
            }
        };

        // Delay adding click listener to prevent immediate trigger
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 100);
    }

    formatHour(hour) {
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:00 ${ampm}`;
    }

    handleTaskScheduled(evt) {
        const taskId = evt.item.dataset.taskId;
        const timeBlock = evt.to;
        const hour = timeBlock.dataset.hour;
        const time = timeBlock.dataset.time;

        if (!taskId || !hour) {
            console.warn('Missing task ID or hour in handleTaskScheduled');
            return;
        }

        // Check if time block already has a task (not completed)
        const existingTask = timeBlock.querySelector('.task-card:not([data-completed="true"])');
        if (existingTask && existingTask !== evt.item) {
           // Prevent scheduling if slot is occupied
           this.taskManager.showToast('Time slot is already occupied', 'error');
           // Revert the drag
           if (evt.from) {
             evt.from.appendChild(evt.item);
            }
            return;
        }

        // Update task as scheduled
        this.taskManager.updateTask(taskId, {
            scheduled: true,
            timeSlot: hour,
            scheduledTime: time
        });

        // Add visual indicators
        timeBlock.classList.add('has-task');
        evt.item.classList.add('scheduled');

        // Replace the dragged element with properly bound task card
        const task = this.taskManager.getTask(taskId);
        if (task) {
            const newTaskElement = this.createTaskCard(task, timeBlock);
            evt.item.replaceWith(newTaskElement);
        }

        // Show notification
        this.taskManager.showToast(`Task scheduled for ${this.formatHour(parseInt(hour))}`, 'success');
        
        // Update stats
        this.taskManager.updateStats();
        
        // Check for desktop notification
        this.scheduleNotification(taskId, time);
    }

    showInlineEditor(taskElement) {
        const taskId = taskElement.dataset.taskId;
        const task = this.taskManager.getTask(taskId);
        if (!task) return;

        // Prevent multiple editors
        if (this.activeEditors.has(taskId) || taskElement.querySelector('.task-inline-editor')) {
            return;
        }

        // Mark this task as being edited
        this.activeEditors.add(taskId);

        // Store original content
        const originalContent = taskElement.innerHTML;
        const timeBlock = taskElement.closest('.time-block');
        const taskPool = taskElement.closest('#taskPool');

        // Create inline editor
        const editor = document.createElement('div');
        editor.className = 'task-inline-editor';
        editor.innerHTML = `
            <input type="text" class="edit-title" value="${this.taskManager.escapeHtml(task.title)}" placeholder="Task title">
            <textarea class="edit-description" placeholder="Task description">${this.taskManager.escapeHtml(task.description || '')}</textarea>
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

        // Replace task content with editor
        taskElement.innerHTML = '';
        taskElement.appendChild(editor);

        // Focus title input
        const titleInput = editor.querySelector('.edit-title');
        titleInput.focus();
        titleInput.select();

        // Save handler
        const saveHandler = () => {
            const updates = {
                title: editor.querySelector('.edit-title').value.trim(),
                description: editor.querySelector('.edit-description').value.trim(),
                priority: editor.querySelector('.edit-priority').value,
                duration: parseInt(editor.querySelector('.edit-duration').value)
            };

            if (!updates.title) {
                this.taskManager.showToast('Task title cannot be empty', 'error');
                return;
            }

            // Update the task
            this.taskManager.updateTask(taskId, updates);
            const updatedTask = this.taskManager.getTask(taskId);
        
            // Recreate the task card with updated data
            const newTaskElement = this.createTaskCard(updatedTask, timeBlock || taskPool);
            taskElement.replaceWith(newTaskElement);
        
            // Remove from active editors
            this.activeEditors.delete(taskId);
            
            // Clean up event listeners
            document.removeEventListener('keydown', keyHandler);
        
            this.taskManager.showToast('Task updated successfully', 'success');
        };

        // Cancel handler
        const cancelHandler = () => {
            taskElement.innerHTML = originalContent;
            // Rebind events properly
            this.bindTaskActions(taskElement, taskId);
            // Remove from active editors
            this.activeEditors.delete(taskId);
            // Clean up event listeners
            document.removeEventListener('keydown', keyHandler);
        };

        // Handle keyboard events
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                cancelHandler();
            } else if (e.key === 'Enter' && e.ctrlKey) {
                saveHandler();
            }
        };

        // Bind handlers using onclick to prevent multiple listeners
        editor.querySelector('.save-edit').onclick = saveHandler;
        editor.querySelector('.cancel-edit').onclick = cancelHandler;

        // Add keyboard handler
        document.addEventListener('keydown', keyHandler);

        // Handle Enter key in title input
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveHandler();
            }
        });
    }

    handleTaskUnscheduled(evt) {
        const taskId = evt.item.dataset.taskId;
        
        if (!taskId) {
            console.warn('Missing task ID in handleTaskUnscheduled');
            return;
        }
        
        // Update task as unscheduled
        this.taskManager.updateTask(taskId, {
            scheduled: false,
            timeSlot: null,
            scheduledTime: null
        });

        // Remove visual indicators
        if (evt.from && evt.from.classList.contains('time-block')) {
            evt.from.classList.remove('has-task');
        }
        evt.item.classList.remove('scheduled');

        // Replace dragged element with properly bound task card for task pool
        const task = this.taskManager.getTask(taskId);
        if (task && evt.to.id === 'taskPool') {
            const newTaskElement = this.createTaskCard(task, evt.to);
            evt.item.replaceWith(newTaskElement);
        }

        // Show notification
        this.taskManager.showToast('Task moved to unscheduled', 'info');
        
        // Update stats
        this.taskManager.updateStats();
    }

    handleTaskMoved(evt) {
        if (evt.from === evt.to) return;

        const taskId = evt.item.dataset.taskId;
        
        if (!taskId) {
            console.warn('Missing task ID in handleTaskMoved');
            return;
        }
        
        // Update old time block
        if (evt.from.classList.contains('time-block')) {
            evt.from.classList.remove('has-task');
        }
        
        // Update new time block
        if (evt.to.classList.contains('time-block')) {
            const hour = evt.to.dataset.hour;
            const time = evt.to.dataset.time;
            
            this.taskManager.updateTask(taskId, {
                scheduled: true,
                timeSlot: hour,
                scheduledTime: time
            });
            
            evt.to.classList.add('has-task');
            
            // Replace with properly bound task card
            const task = this.taskManager.getTask(taskId);
            if (task) {
                const newTaskElement = this.createTaskCard(task, evt.to);
                evt.item.replaceWith(newTaskElement);
            }
            
            this.taskManager.showToast(`Task rescheduled to ${this.formatHour(parseInt(hour))}`, 'success');
        }
        
        this.taskManager.updateStats();
    }

    handleTaskReordered(evt) {
        // Handle reordering within task pool if needed
        // This is mainly for visual feedback
        this.taskManager.updateStats();
    }

    async scheduleNotification(taskId, time) {
        const task = this.taskManager.getTask(taskId);
        if (!task || !window.electronAPI) return;

        try {
            // Calculate notification time (5 minutes before)
            const [hours, minutes] = time.split(':').map(Number);
            const taskTime = new Date();
            taskTime.setHours(hours, minutes - 5, 0, 0);
            
            const now = new Date();
            const delay = taskTime.getTime() - now.getTime();
            
            if (delay > 0) {
                setTimeout(async () => {
                    try {
                        await window.electronAPI.showNotification(
                            'Task Reminder',
                            `"${task.title}" is scheduled in 5 minutes`
                        );
                    } catch (error) {
                        console.warn('Failed to show notification:', error);
                    }
                }, delay);
            }
        } catch (error) {
            console.warn('Failed to schedule notification:', error);
        }
    }

    refreshAll() {
        // Clean up existing sortable instances
        this.sortableInstances.forEach(instance => {
            instance.destroy();
        });
        this.sortableInstances.clear();

        // Clear active editors
        this.activeEditors.clear();

        // Refresh drag and drop instances
        this.init();
        this.taskManager.renderTasks();
    }

    loadScheduledTasks() {
        if (!this.taskManager || typeof this.taskManager.getAllTasks !== 'function') {
          console.warn('TaskManager.getAllTasks not available yet');
          return;
        }
        const tasks = this.taskManager.getAllTasks();
        tasks.forEach(task => {
            if (task.scheduled && task.timeSlot) {
                const timeSlot = parseInt(task.timeSlot);
                
                // Check if task fits in current schedule range
                if (timeSlot >= this.scheduleHours.start && timeSlot <= this.scheduleHours.end) {
                    const timeBlock = document.querySelector(`[data-hour="${task.timeSlot}"]`);
                    if (timeBlock) {
                        // Clear existing tasks first
                        const existingTask = timeBlock.querySelector('.task-card');
                        if (existingTask) {
                            existingTask.remove();
                        }

                        const taskElement = this.createTaskCard(task, timeBlock);
                        timeBlock.appendChild(taskElement);
                        
                        // Set appropriate class based on completion status
                        if (task.completed) {
                            timeBlock.classList.add('has-completed-task');
                        } else {
                            timeBlock.classList.add('has-task');
                        }
                    }
                }
            }
        });
    }

    checkTimeSlotAvailability(timeBlock, excludeTaskId = null) {
        const existingTask = timeBlock.querySelector('.task-card');
        if (!existingTask) return true;
        
        const taskId = existingTask.dataset.taskId;
        const isCompleted = existingTask.dataset.completed === 'true';
        
        // Allow if excluding this task or if existing task is completed
        return (excludeTaskId && taskId === excludeTaskId) || isCompleted;
    }

    bindTaskActions(taskElement, taskId) {
        // Remove any existing event listeners to prevent duplicates
        const completeBtn = taskElement.querySelector('.mark-complete');
        const editBtn = taskElement.querySelector('.edit-task');
        const deleteBtn = taskElement.querySelector('.delete-task');

        if (completeBtn) {
            // Remove existing handler if any
            if (completeBtn.clickHandler) {
                completeBtn.removeEventListener('click', completeBtn.clickHandler);
            }
            
            completeBtn.clickHandler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                this.taskManager.toggleTaskComplete(taskId);
                const task = this.taskManager.getTask(taskId);
                if (!task) return;
            
                taskElement.classList.toggle('completed', task.completed);
                taskElement.dataset.completed = task.completed;
                
                // Update completion status display
                const statusSpan = taskElement.querySelector('.task-completion-status');
                if (statusSpan) {
                    statusSpan.innerHTML = task.completed ? 
                        '<i class="fas fa-check-circle text-success"></i> Completed' : 
                        '<i class="fas fa-hourglass-half text-muted"></i> In Progress';
                }
                
                // Update the completion button
                const button = taskElement.querySelector('.mark-complete i');
                if (button) {
                    button.className = `fas fa-${task.completed ? 'undo' : 'check'}`;
                    button.parentElement.title = task.completed ? 'Mark Incomplete' : 'Mark Complete';
                }

                // Allow adding new tasks to this slot if the task is completed
                const timeBlock = taskElement.closest('.time-block');
                if (timeBlock) {
                    if (task.completed) {
                        timeBlock.classList.add('has-completed-task');
                        timeBlock.classList.remove('has-task');
                    } else {
                        timeBlock.classList.remove('has-completed-task');
                        timeBlock.classList.add('has-task');
                    }
                }

                // Update stats
                this.taskManager.updateStats();
            };
            
            completeBtn.addEventListener('click', completeBtn.clickHandler);
        }

        if (editBtn) {
            // Remove existing handler if any
            if (editBtn.clickHandler) {
                editBtn.removeEventListener('click', editBtn.clickHandler);
            }
            
            editBtn.clickHandler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.showInlineEditor(taskElement);
            };
            
            editBtn.addEventListener('click', editBtn.clickHandler);
        }

        if (deleteBtn) {
            // Remove existing handler if any
            if (deleteBtn.clickHandler) {
                deleteBtn.removeEventListener('click', deleteBtn.clickHandler);
            }
            
            deleteBtn.clickHandler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                if (confirm('Are you sure you want to delete this task?')) {
                    const timeBlock = taskElement.closest('.time-block');
                    
                    // Remove from active editors if being edited
                    this.activeEditors.delete(taskId);
                    
                    // Remove task element
                    taskElement.remove();
                    
                    // Update time block classes
                    if (timeBlock) {
                        timeBlock.classList.remove('has-task', 'has-completed-task');
                        
                        // Re-bind click handler to ensure it works for adding new tasks
                        this.bindTimeBlockClick(timeBlock);
                    }
                    
                    // Delete from task manager
                    this.taskManager.deleteTask(taskId);
                    this.taskManager.showToast('Task deleted', 'success');
                    this.taskManager.updateStats();
                }
            };
            
            deleteBtn.addEventListener('click', deleteBtn.clickHandler);
        }
    }    
     
    createTaskCard(task, container) {
        const taskElement = document.createElement('div');
        taskElement.className = `task-card ${task.completed ? 'completed' : ''}`;
        taskElement.dataset.taskId = task.id;
        taskElement.dataset.completed = task.completed;
        
        taskElement.innerHTML = `
            <div class="task-header">
                <div class="task-title-wrapper">
                    <div class="task-status">
                        <button class="task-action mark-complete" title="${task.completed ? 'Mark Incomplete' : 'Mark Complete'}">
                            <i class="fas fa-${task.completed ? 'undo' : 'check'}"></i>
                        </button>
                    </div>
                    <div class="task-title">${this.taskManager.escapeHtml(task.title)}</div>
                </div>
                <div class="task-actions">
                    <button class="task-action edit-task" title="Edit Task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="task-action delete-task" title="Delete Task">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="task-meta">
                <span class="task-priority ${task.priority}">${task.priority}</span>
                <span class="task-completion-status">
                    ${task.completed ? 
                        '<i class="fas fa-check-circle text-success"></i> Completed' : 
                        '<i class="fas fa-hourglass-half text-muted"></i> In Progress'}
                </span>
                <span class="task-duration">
                    <i class="fas fa-clock"></i>
                    ${task.duration}min
                </span>
            </div>
        `;

        // Bind action handlers properly
        this.bindTaskActions(taskElement, task.id);
        
        return taskElement;
    }

    // Cleanup method
    destroy() {
        // Clean up all sortable instances
        this.sortableInstances.forEach(instance => {
            instance.destroy();
        });
        this.sortableInstances.clear();

        // Clear active editors
        this.activeEditors.clear();

        // Clean up task pool sortable
        const taskPool = document.getElementById('taskPool');
        if (taskPool && taskPool.sortableInstance) {
            taskPool.sortableInstance.destroy();
            taskPool.sortableInstance = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initializeDragDrop = () => {
        let taskManager = null;
        
        // Try different possible TaskManager references
        if (window.taskManager && typeof window.taskManager === 'object') {
            taskManager = window.taskManager;
        } else if (window.TaskManager && typeof window.TaskManager === 'function') {
            // TaskManager is a constructor - instantiate it
            try {
                taskManager = new window.TaskManager();
                window.taskManager = taskManager; // Store for future use
            } catch (error) {
                console.error('Failed to instantiate TaskManager:', error);
                return false;
            }
        } else if (window.TaskManager && typeof window.TaskManager === 'object') {
            taskManager = window.TaskManager;
        }
        
        if (!taskManager) {
            return false;
        }
        
        // Check for required methods (with fallbacks for common alternative names)
        const getAllTasksMethod = taskManager.getAllTasks || taskManager.getTasks || taskManager.loadTasks || taskManager.fetchTasks;
        const getTaskMethod = taskManager.getTask || taskManager.findTask || taskManager.getTaskById || taskManager.findTaskById;
        
        if (typeof getAllTasksMethod === 'function' && typeof getTaskMethod === 'function') {
            // Bind methods if they're not bound
            if (!taskManager.getAllTasks && getAllTasksMethod) {
                taskManager.getAllTasks = getAllTasksMethod.bind(taskManager);
            }
            if (!taskManager.getTask && getTaskMethod) {
                taskManager.getTask = getTaskMethod.bind(taskManager);
            }
            
            // Initialize DragDropManager
            window.dragDropManager = new DragDropManager(taskManager);
            console.log('DragDropManager initialized successfully');
            return true;
        }
        
        console.warn('TaskManager exists but missing required methods:', {
            getAllTasks: typeof getAllTasksMethod,
            getTask: typeof getTaskMethod,
            availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(taskManager))
        });
        
        return false;
    };

    if (!initializeDragDrop()) {
        console.warn('TaskManager not ready. Retrying...');
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds with 100ms intervals
        
        const retryInterval = setInterval(() => {
            attempts++;
            if (initializeDragDrop()) {
                clearInterval(retryInterval);
            } else if (attempts >= maxAttempts) {
                clearInterval(retryInterval);
                console.error('Failed to initialize DragDropManager: TaskManager not available after maximum attempts');
                
                // Show user-friendly error message if possible
                const scheduleGrid = document.getElementById('scheduleGrid');
                if (scheduleGrid) {
                    scheduleGrid.innerHTML = `
                        <div class="error-message">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h3>Initialization Error</h3>
                            <p>Failed to initialize the task scheduler. Please refresh the page.</p>
                            <button onclick="location.reload()" class="btn-primary">
                                <i class="fas fa-refresh"></i> Refresh Page
                            </button>
                        </div>
                    `;
                }
            }
        }, 100);
    }
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DragDropManager;
}