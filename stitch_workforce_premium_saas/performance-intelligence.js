document.addEventListener('DOMContentLoaded', () => {
    // 1. Element references
    const teamList = document.getElementById('team-performance-list');
    const areaChartDom = document.getElementById('pi-area-chart');
    const presetSelect = document.getElementById('pi-preset-select');
    const menuBtn = document.getElementById('pi-menu-btn');
    const optionsDropdown = document.getElementById('pi-options-dropdown');
    const btnRefresh = document.getElementById('btn-pi-refresh');
    const btnExport = document.getElementById('btn-pi-export-csv');
    const btnFullscreen = document.getElementById('btn-pi-fullscreen');
    const liveText = document.getElementById('pi-live-text');

    // 2. Drill-down Click Handlers on Micro KPI Cards
    document.getElementById('kpi-completed-tasks')?.addEventListener('click', () => {
        window.location.href = '/admin-tasks.html';
    });
    document.getElementById('kpi-productivity')?.addEventListener('click', () => {
        window.location.href = '/admin-monitoring.html';
    });
    document.getElementById('kpi-project-health')?.addEventListener('click', () => {
        window.location.href = '/admin-customers.html';
    });
    document.getElementById('kpi-completion-time')?.addEventListener('click', () => {
        window.location.href = '/admin-tasks.html';
    });

    // 3. Options Menu Dropdown Toggle
    if (menuBtn && optionsDropdown) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = optionsDropdown.style.display === 'none';
            optionsDropdown.style.display = isHidden ? 'block' : 'none';
        });

        document.addEventListener('click', () => {
            optionsDropdown.style.display = 'none';
        });
    }

    // 4. Menu Action Handlers
    btnRefresh?.addEventListener('click', () => {
        refreshPerformanceMetrics();
        alert('Performance Intelligence metrics refreshed!');
    });

    btnExport?.addEventListener('click', () => {
        if (typeof window.exportModuleDataFile === 'function') {
            window.exportModuleDataFile('tasks', 'xlsx');
        } else {
            alert('Exporting Performance Intelligence metrics...');
        }
    });

    btnFullscreen?.addEventListener('click', () => {
        const card = document.getElementById('performance-intelligence-card');
        if (card) {
            if (!document.fullscreenElement) {
                card.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
        }
    });

    // 5. Preset Switcher Logic
    presetSelect?.addEventListener('change', (e) => {
        const preset = e.target.value;
        const aiText = document.getElementById('pi-ai-text');
        if (!aiText) return;

        switch (preset) {
            case 'hr':
                aiText.textContent = 'HR Preset Active: 4 pending leave approvals. High retention index (94%). Recommend scheduling Q3 orientation.';
                break;
            case 'operations':
                aiText.textContent = 'Operations Preset Active: 3 branch office setups on schedule. ISP link installation delayed by 1 day in Pune Branch.';
                break;
            case 'pm':
                aiText.textContent = 'Project Manager Preset Active: Website Development phase 3 in QA. 2 overdue subtasks in REST API Backend module.';
                break;
            case 'executive':
            default:
                aiText.textContent = 'Development Team efficiency dropped 8% due to 12 overdue subtasks. Recommendation: Reassign 3 tasks to Testing Team.';
                break;
        }
    });

    // 6. Populate Team Performance Heatmap Table (Disabled to allow dynamic workflows metrics)
    const renderTeamHeatmapTable = () => {};

    // 7. Initialize ECharts Productive vs. Idle Stacked Area Chart (Dynamic API-driven)
    let areaChartInstance = null;
    const initAreaChart = async () => {
        if (!areaChartDom || typeof echarts === 'undefined') return;

        areaChartInstance = echarts.init(areaChartDom, null, { renderer: 'svg' });
        
        let dates = [];
        let workData = [];
        let meetingsData = [];
        let breakData = [];
        let idleData = [];

        try {
            const res = await fetch("/api/v1/admin/employees/productivity-trend", { credentials: 'include' });
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                json.data.forEach(row => {
                    dates.push(row.date_str);
                    workData.push(parseFloat(row.productive_hours || 0));
                    meetingsData.push(parseFloat(row.unproductive_hours || 0));
                    breakData.push(parseFloat(row.break_hours || 0));
                    idleData.push(parseFloat(row.idle_hours || 0));
                });
            }
        } catch (e) {
            console.error("Error loading productivity trend chart:", e);
        }

        // If no data returned from API, render a clean baseline of the last 7 days with zero activity
        if (dates.length === 0) {
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                dates.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
                workData.push(0);
                meetingsData.push(0);
                breakData.push(0);
                idleData.push(0);
            }
        }

        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross', label: { backgroundColor: '#0c4a40' } }
            },
            legend: {
                data: ['Work', 'Meetings', 'Break', 'Idle'],
                bottom: 0,
                textStyle: { color: '#1f2a24', fontWeight: 'bold', fontSize: 11 }
            },
            grid: { left: '3%', right: '4%', top: '10%', bottom: '18%', containLabel: true },
            xAxis: [
                {
                    type: 'category',
                    boundaryGap: false,
                    data: dates,
                    axisLine: { lineStyle: { color: 'rgba(0,0,0,0.1)' } },
                    axisLabel: { color: '#5b6660', fontWeight: 'bold' }
                }
            ],
            yAxis: [
                {
                    type: 'value',
                    axisLine: { show: false },
                    splitLine: { lineStyle: { color: 'rgba(0,0,0,0.05)' } },
                    axisLabel: { color: '#5b6660' }
                }
            ],
            series: [
                {
                    name: 'Work',
                    type: 'line',
                    stack: 'Total',
                    smooth: true,
                    areaStyle: { opacity: 0.6, color: '#10b981' },
                    lineStyle: { color: '#10b981' },
                    data: workData
                },
                {
                    name: 'Meetings',
                    type: 'line',
                    stack: 'Total',
                    smooth: true,
                    areaStyle: { opacity: 0.6, color: '#0284c7' },
                    lineStyle: { color: '#0284c7' },
                    data: meetingsData
                },
                {
                    name: 'Break',
                    type: 'line',
                    stack: 'Total',
                    smooth: true,
                    areaStyle: { opacity: 0.6, color: '#f59e0b' },
                    lineStyle: { color: '#f59e0b' },
                    data: breakData
                },
                {
                    name: 'Idle',
                    type: 'line',
                    stack: 'Total',
                    smooth: true,
                    areaStyle: { opacity: 0.6, color: '#ef4444' },
                    lineStyle: { color: '#ef4444' },
                    data: idleData
                }
            ]
        };

        areaChartInstance.setOption(option);
        window.addEventListener('resize', () => areaChartInstance && areaChartInstance.resize());
    };

    // 8. Adaptive Refresh Strategy (30s background poll, pauses when tab hidden)
    let lastUpdatedSec = 0;
    let refreshInterval = null;

    const refreshPerformanceMetrics = () => {
        lastUpdatedSec = 0;
        if (liveText) liveText.textContent = 'Live · Updated 0s ago';
        renderTeamHeatmapTable();
        initAreaChart();
    };

    const startAdaptivePolling = () => {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            if (!document.hidden) {
                lastUpdatedSec += 5;
                if (liveText) liveText.textContent = `Live · Updated ${lastUpdatedSec}s ago`;
                if (lastUpdatedSec >= 30) {
                    refreshPerformanceMetrics();
                }
            }
        }, 5000);
    };

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            refreshPerformanceMetrics();
        }
    });

    // Run initial rendering routines
    renderTeamHeatmapTable();
    initAreaChart();
    startAdaptivePolling();
});
