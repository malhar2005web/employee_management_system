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

    // 6. Populate Team Performance Heatmap Table
    const renderTeamHeatmapTable = () => {
        if (!teamList) return;
        const teamsData = [
            { team: 'Development', allocated: 58, completed: 54, delayed: 4, efficiency: '94%', util: '81%', risk: 'Medium', age: '2.1d', riskColor: '#f59e0b' },
            { team: 'Testing', allocated: 42, completed: 40, delayed: 2, efficiency: '95%', util: '77%', risk: 'Low', age: '1.8d', riskColor: '#10b981' },
            { team: 'Support', allocated: 29, completed: 27, delayed: 2, efficiency: '93%', util: '64%', risk: 'Low', age: '1.4d', riskColor: '#10b981' },
            { team: 'Design', allocated: 17, completed: 16, delayed: 1, efficiency: '96%', util: '49%', risk: 'Low', age: '1.2d', riskColor: '#10b981' }
        ];

        teamList.innerHTML = teamsData.map(t => `
            <tr style="cursor: pointer; font-size: 12.5px; border-bottom: 1px solid rgba(0,0,0,0.04);" onclick="window.location.href='/admin-organization.html'">
                <td style="padding: 10px 8px; font-weight: 800; color: var(--teal-900);">${t.team}</td>
                <td style="padding: 10px 8px; font-weight: 700;">${t.allocated}</td>
                <td style="padding: 10px 8px; font-weight: 700; color: #10b981;">${t.completed}</td>
                <td style="padding: 10px 8px; font-weight: 700; color: #ef4444;">${t.delayed}</td>
                <td style="padding: 10px 8px; font-weight: 800;">${t.efficiency}</td>
                <td style="padding: 10px 8px; font-weight: 700;">${t.util}</td>
                <td style="padding: 10px 8px;"><span class="status-pill" style="background: ${t.riskColor}20; color: ${t.riskColor}; font-size: 10.5px; font-weight: 800;">${t.risk}</span></td>
                <td style="padding: 10px 8px; font-weight: 700; color: var(--text-muted);">${t.age}</td>
            </tr>
        `).join('');
    };

    // 7. Initialize ECharts Productive vs. Idle Stacked Area Chart
    let areaChartInstance = null;
    const initAreaChart = () => {
        if (!areaChartDom || typeof echarts === 'undefined') return;

        areaChartInstance = echarts.init(areaChartDom, null, { renderer: 'svg' });
        const dates = ['Day 1', 'Day 5', 'Day 10', 'Day 15', 'Day 20', 'Day 25', 'Day 30'];

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
                    data: [120, 132, 101, 134, 190, 230, 210]
                },
                {
                    name: 'Meetings',
                    type: 'line',
                    stack: 'Total',
                    smooth: true,
                    areaStyle: { opacity: 0.6, color: '#0284c7' },
                    lineStyle: { color: '#0284c7' },
                    data: [40, 45, 30, 50, 40, 60, 55]
                },
                {
                    name: 'Break',
                    type: 'line',
                    stack: 'Total',
                    smooth: true,
                    areaStyle: { opacity: 0.6, color: '#f59e0b' },
                    lineStyle: { color: '#f59e0b' },
                    data: [20, 18, 25, 22, 20, 24, 21]
                },
                {
                    name: 'Idle',
                    type: 'line',
                    stack: 'Total',
                    smooth: true,
                    areaStyle: { opacity: 0.6, color: '#ef4444' },
                    lineStyle: { color: '#ef4444' },
                    data: [15, 12, 20, 14, 10, 12, 11]
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
        if (areaChartInstance) areaChartInstance.resize();
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
