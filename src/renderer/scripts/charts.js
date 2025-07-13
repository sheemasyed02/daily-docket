class ChartManager { 
    constructor() {
        this.progressChart = null;
        this.priorityChart = null;
        this.init();
    }

    init() {
        this.initProgressChart();
        this.initPriorityChart();
    }

    initProgressChart() {
        const ctx = document.getElementById('progressChart');
        if (!ctx) return;

        this.progressChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: [
                        '#6366f1',
                        '#e2e8f0'
                    ],
                    borderWidth: 0,
                    cutout: '70%'
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 1000
                }
            }
        });
    }

    initPriorityChart() {
        const ctx = document.getElementById('priorityChart');
        if (!ctx) return;

        this.priorityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['High', 'Medium', 'Low'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        '#ef4444',
                        '#f59e0b',
                        '#10b981'
                    ],
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} tasks`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: false
                        }
                    }
                },
                animation: {
                    duration: 800
                }
            }
        });
    }

    updateProgressChart(percentage) {
        if (!this.progressChart) return;

        this.progressChart.data.datasets[0].data = [percentage, 100 - percentage];
        this.progressChart.update('active');
    }

    updatePriorityChart(stats) {
        if (!this.priorityChart) return;

        this.priorityChart.data.datasets[0].data = [
            stats.high || 0,
            stats.medium || 0,
            stats.low || 0
        ];
        this.priorityChart.update('active');
    }

    destroy() {
        if (this.progressChart) {
            this.progressChart.destroy();
        }
        if (this.priorityChart) {
            this.priorityChart.destroy();
        }
    }
}

// Initialize chart manager after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chartManager = new ChartManager();
});
