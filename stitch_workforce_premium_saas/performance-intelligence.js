document.addEventListener('DOMContentLoaded', () => {
  const workflowDonut = document.getElementById('pi-workflow-donut');
  const barChart = document.getElementById('pi-bar-chart');
  const healthPie = document.getElementById('pi-health-pie');
  const teamBars = document.getElementById('pi-team-bars');
  const teamList = document.getElementById('team-performance-list');
  const carousel = document.getElementById('performance-intelligence');
  const dots = document.getElementById('pi-carousel-dots');

  if (!workflowDonut || !barChart || !healthPie || !teamBars || !teamList || !carousel || !dots) return;

  const avg = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const chartInstances = [];

  const daysBetween = (start, end) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
    return Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
  };

  const isDelayed = task => {
    if (!task.deadline || task.status === 'Completed') return false;
    return new Date(task.deadline) < new Date();
  };

  const setDetail = (card, text) => {
    const detail = card.closest('.read-only-box')?.querySelector('.pi-chart-detail');
    if (detail) detail.textContent = text;
  };

  // Helper for animating numbers from 0 to actual value
  const animateCounter = (element, targetValue, suffix = '') => {
    if (!element) return;
    const start = 0;
    const duration = 1200; // 1.2 seconds
    const startTime = performance.now();
    
    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const ease = progress * (2 - progress);
      const current = typeof targetValue === 'number'
        ? (start + ease * (targetValue - start))
        : parseFloat(start + ease * (parseFloat(targetValue) - start));
      
      if (Number.isInteger(targetValue)) {
        element.textContent = `${Math.round(current)}${suffix}`;
      } else {
        element.textContent = `${current.toFixed(1)}${suffix}`;
      }
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = `${targetValue}${suffix}`;
      }
    };
    requestAnimationFrame(update);
  };

  // Draw responsive sparkline inside card
  const drawSparkline = (containerId, values, color = '#18C29C') => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const width = 140;
    const height = 24;
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;
    const points = values.map((val, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const y = height - 2 - ((val - minVal) / range) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    
    container.innerHTML = `
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible;">
        <path d="M ${points.join(' L ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
  };

  // Create or retrieve floating tooltip
  const getTooltip = () => {
    let t = document.getElementById('pi-tooltip');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pi-tooltip';
      t.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        padding: 8px 12px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 700;
        color: #fff;
        background: rgba(12, 74, 64, 0.92);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.1s ease;
        transform: translate(-50%, -125%);
      `;
      document.body.appendChild(t);
    }
    return t;
  };

  // Render proportional SVG Donut Chart using Apache ECharts
  const drawDonutChart = (domElement, segments, centerText, subText = '', cardElement) => {
    if (!domElement) return null;
    
    domElement.innerHTML = '';
    domElement.style.position = 'relative';

    // 1. Create ECharts canvas container
    const chartDom = document.createElement('div');
    chartDom.style.width = '100%';
    chartDom.style.height = '100%';
    domElement.appendChild(chartDom);

    // 2. Create Frosted Glass Center Badge
    const badge = document.createElement('div');
    badge.className = 'pi-donut-center-badge';
    badge.innerHTML = `
      <div class="pi-donut-center-value" data-target="${centerText}">0</div>
      <div class="pi-donut-center-label">${subText}</div>
    `;
    domElement.appendChild(badge);

    // 3. Initialize Apache ECharts in SVG mode
    const myChart = echarts.init(chartDom, null, { renderer: 'svg' });

    // 4. Map segments to proportional ECharts data items with linear gradients
    const chartData = segments.map(seg => ({
      name: seg.label,
      value: seg.value,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
          { offset: 0, color: seg.gradientFrom },
          { offset: 100, color: seg.gradientTo }
        ])
      }
    }));

    const option = {
      animation: true,
      animationDuration: 1200,
      animationEasing: 'cubicOut',
      series: [
        {
          name: subText,
          type: 'pie',
          radius: ['58%', '80%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 6,
            itemStyle: {
              shadowBlur: 8,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.12)'
            }
          },
          itemStyle: {
            borderRadius: 7,
            borderColor: '#ffffff',
            borderWidth: 2
          },
          data: chartData
        }
      ]
    };

    myChart.setOption(option);

    // 5. Connect ECharts interactions to the custom floating tooltip
    const tooltip = getTooltip();
    myChart.on('mouseover', (params) => {
      tooltip.textContent = `${params.name}: ${params.value}`;
      tooltip.style.opacity = '1';
    });
    myChart.on('mousemove', (e) => {
      tooltip.style.left = `${e.event.event.clientX}px`;
      tooltip.style.top = `${e.event.event.clientY}px`;
    });
    myChart.on('mouseout', () => {
      tooltip.style.opacity = '0';
    });

    // 6. Connect ECharts segment clicks to focus mode modal
    myChart.on('click', () => {
      if (cardElement) {
        // Trigger modal opening by simulating a click on the parent card
        cardElement.click();
      }
    });

    // 7. Animate center value badge count
    setTimeout(() => {
      const valEl = badge.querySelector('.pi-donut-center-value');
      const valText = valEl.dataset.target || '';
      const numVal = parseInt(valText, 10);
      if (!isNaN(numVal)) {
        const suffix = valText.includes('%') ? '%' : '';
        animateCounter(valEl, numVal, suffix);
      } else {
        valEl.textContent = valText;
      }
    }, 100);

    chartInstances.push(myChart);
    return myChart;
  };

  const renderBarChart = (productivity, onTime) => {
    const bars = [
      { label: 'Productivity', value: productivity, color: 'linear-gradient(180deg,#8b5cf6,#6d28d9)' },
      { label: 'On Time', value: onTime, color: 'linear-gradient(180deg,#18C29C,#0FA87C)' }
    ];

    barChart.innerHTML = bars.map(bar => `
      <div class="pi-bar-item" data-detail="${bar.label}: ${bar.value}%" style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;height:100%;">
        <strong class="pi-bar-value" style="font-size:12px;color:#1f2a24;">0%</strong>
        <div class="pi-bar-column">
          <div class="pi-bar-fill" style="--bar-height:${Math.max(4, bar.value)}%;background:${bar.color};"><span></span></div>
        </div>
        <span style="font-size:10.5px;color:var(--text-muted);font-weight:800;text-align:center;">${bar.label}</span>
      </div>
    `).join('') + '<div class="pi-chart-detail">Hover a bar to inspect values</div>';

    // Animate bar values
    setTimeout(() => {
      document.querySelectorAll('.pi-bar-item').forEach((item, idx) => {
        const valEl = item.querySelector('.pi-bar-value');
        animateCounter(valEl, bars[idx].value, '%');
      });
    }, 100);
  };

  const renderTeamAnalytics = workflows => {
    const teams = new Map();

    workflows.forEach(workflow => {
      (workflow.teams || []).forEach(team => {
        if (!teams.has(team.id)) {
          teams.set(team.id, {
            name: team.name,
            allocated: 0,
            completed: 0,
            estimatedDays: [],
            actualDays: []
          });
        }
      });

      (workflow.tasks || []).forEach(task => {
        const team = teams.get(task.assigned_team_id);
        if (!team) return;
        team.allocated += 1;
        if (task.status === 'Completed') team.completed += 1;

        const estimatedDays = task.estimated_hours ? Math.max(1, parseFloat(task.estimated_hours) / 8) : null;
        const actualDays = daysBetween(task.created_at, task.updated_at);
        if (estimatedDays) team.estimatedDays.push(estimatedDays);
        if (actualDays && task.status === 'Completed') team.actualDays.push(actualDays);
      });
    });

    const analytics = Array.from(teams.values()).map(team => {
      const estimated = avg(team.estimatedDays);
      const actual = avg(team.actualDays);
      const completionScore = team.allocated ? (team.completed / team.allocated) * 100 : 0;
      const speedScore = estimated && actual ? Math.min(160, (estimated / actual) * 100) : completionScore;
      const efficiency = Math.round((completionScore + speedScore) / 2);
      return { ...team, efficiency };
    }).sort((a, b) => b.efficiency - a.efficiency);

    const bubbleColors = ['#8b5cf6', '#6366f1', '#ec4899', '#f97316', '#22c55e'];
    teamBars.innerHTML = analytics.length
      ? `<div class="pi-bubble-plot">
          ${analytics.slice(0, 6).map((team, index) => {
            const left = 8 + (index % 3) * 31;
            const top = 88 - Math.min(84, team.efficiency * 0.75);
            const size = 38 + Math.min(32, team.allocated * 4);
            return `
              <div class="pi-bubble pi-team-row" data-detail="${team.name}: ${team.efficiency}% efficiency, ${team.completed}/${team.allocated} completed" style="left:${left}%;top:${top}px;width:${size}px;height:${size}px;background:linear-gradient(180deg,${bubbleColors[index % bubbleColors.length]},#6d28d9);">
                ${team.efficiency}
              </div>
            `;
          }).join('')}
        </div>
        <div class="pi-chart-detail">Hover or click a bubble to inspect team efficiency</div>`
      : '<div style="text-align:center;color:var(--text-muted);font-size:13px;font-weight:700;padding-top:48px;">No team chart yet</div><div class="pi-chart-detail">Create workflow teams to generate bubbles</div>';

    teamList.innerHTML = analytics.length
      ? analytics.map(team => {
        const cls = team.efficiency >= 90 ? 'progress' : team.efficiency >= 70 ? 'pending' : 'delayed';
        return `
          <tr>
            <td class="task-name">${team.name}</td>
            <td>${team.allocated}</td>
            <td>${team.completed}</td>
            <td><span class="status-pill ${cls}">${team.efficiency}%</span></td>
          </tr>
        `;
      }).join('')
      : '<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--text-muted);">No workflow team analytics yet</td></tr>';
  };

  const render = workflows => {
    const tasks = workflows.flatMap(workflow => workflow.tasks || []);
    const completedTasks = tasks.filter(task => task.status === 'Completed').length;
    const runningTasks = tasks.filter(task => task.status === 'In Progress').length;
    const blockedTasks = tasks.filter(task => task.status === 'Blocked').length;
    const delayedTasks = tasks.filter(isDelayed).length;

    const completedWorkflows = workflows.filter(w => w.status === 'Completed').length;
    const runningWorkflows = workflows.filter(w => w.status === 'In Progress').length;
    const blockedWorkflows = workflows.filter(w => w.status === 'On Hold').length;
    const pendingWorkflows = workflows.filter(w => w.status === 'Planning' || !w.status).length;

    const productivity = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const onTime = tasks.length ? Math.round(((tasks.length - delayedTasks) / tasks.length) * 100) : 0;
    const healthy = Math.max(0, onTime - blockedTasks * 5);
    const atRisk = Math.max(0, 100 - healthy - delayedTasks * 8);
    const delayed = Math.max(0, 100 - healthy - atRisk);

    const completedTaskObjects = tasks.filter(t => t.status === 'Completed');
    const avgLeadTime = completedTaskObjects.length
      ? (completedTaskObjects.reduce((sum, t) => sum + (daysBetween(t.created_at, t.updated_at) || 1), 0) / completedTaskObjects.length).toFixed(1)
      : '4.8';

    // Set KPI values with counter animation
    animateCounter(document.getElementById('kpi-val-completed'), completedTasks);
    animateCounter(document.getElementById('kpi-val-productivity'), productivity, '%');
    animateCounter(document.getElementById('kpi-val-health'), healthy, '%');
    animateCounter(document.getElementById('kpi-val-leadtime'), parseFloat(avgLeadTime), 'd');

    // Draw sparklines
    drawSparkline('kpi-spark-completed', [5, 8, 12, 10, 15, 20, completedTasks], '#18C29C');
    drawSparkline('kpi-spark-productivity', [60, 65, 70, 72, 75, 80, productivity], '#8b5cf6');
    drawSparkline('kpi-spark-health', [85, 90, 88, 92, 90, 89, healthy], '#ffb648');
    drawSparkline('kpi-spark-leadtime', [6.2, 5.8, 5.5, 5.2, 5.0, 4.9, parseFloat(avgLeadTime)], '#ff6b6b');

    // Identify parent slide containers for clicks
    const workflowSlide = workflowDonut.closest('.read-only-box');
    const healthSlide = healthPie.closest('.read-only-box');

    // Render donut charts using Apache ECharts with the requested premium gradients
    drawDonutChart(workflowDonut, [
      { label: 'Completed', value: completedWorkflows, gradientFrom: '#18C29C', gradientTo: '#0FA87C' },
      { label: 'Running', value: runningWorkflows, gradientFrom: '#4F8CFF', gradientTo: '#2563EB' },
      { label: 'Delayed', value: blockedWorkflows, gradientFrom: '#FF6B6B', gradientTo: '#E53935' },
      { label: 'Pending', value: pendingWorkflows, gradientFrom: '#FFB648', gradientTo: '#FF8B1F' }
    ], workflows.length, 'flows', workflowSlide);

    drawDonutChart(healthPie, [
      { label: 'Healthy', value: Math.round(healthy), gradientFrom: '#18C29C', gradientTo: '#0FA87C' },
      { label: 'Running', value: Math.round(atRisk), gradientFrom: '#4F8CFF', gradientTo: '#2563EB' },
      { label: 'Delayed', value: Math.round(delayed), gradientFrom: '#FF6B6B', gradientTo: '#E53935' }
    ], `${Math.round(healthy)}%`, 'health', healthSlide);

    renderBarChart(productivity, onTime);
    renderTeamAnalytics(workflows);
    bindChartInteractions();
    wireCarousel();
  };

  const wireCarousel = () => {
    const slides = Array.from(carousel.querySelectorAll('.read-only-box'));
    if (!slides.length || dots.dataset.ready === 'true') return;

    dots.innerHTML = slides.map((_, index) => `<button type="button" class="pi-carousel-dot ${index === 0 ? 'active' : ''}" data-index="${index}" aria-label="Show chart ${index + 1}"></button>`).join('');
    const dotButtons = Array.from(dots.querySelectorAll('.pi-carousel-dot'));

    const getActiveIndex = () => {
      const center = carousel.scrollLeft + carousel.clientWidth / 2;
      return slides.reduce((closestIndex, slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const closestCenter = slides[closestIndex].offsetLeft + slides[closestIndex].offsetWidth / 2;
        return Math.abs(slideCenter - center) < Math.abs(closestCenter - center) ? index : closestIndex;
      }, 0);
    };

    const scrollToSlide = index => {
      carousel.scrollTo({ left: slides[index].offsetLeft, behavior: 'smooth' });
    };

    const setActive = () => {
      const index = getActiveIndex();
      dotButtons.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === index));
      // Force ECharts redraw to fix viewport alignment inside carousel
      chartInstances.forEach(c => {
        if (c) c.resize();
      });
    };

    dotButtons.forEach(dot => {
      dot.addEventListener('click', () => {
        const index = parseInt(dot.dataset.index, 10);
        scrollToSlide(index);
      });
    });

    carousel.addEventListener('scroll', () => window.requestAnimationFrame(setActive));
    carousel.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      const current = getActiveIndex();
      const direction = event.deltaY > 0 ? 1 : -1;
      const next = Math.max(0, Math.min(slides.length - 1, current + direction));
      scrollToSlide(next);
    }, { passive: false });

    dots.dataset.ready = 'true';
  };

  const bindChartInteractions = () => {
    // Parallax Tilt on cards
    const cardsToTilt = document.querySelectorAll(
      '.performance-card, #performance-intelligence > .read-only-box, .pi-kpi-card'
    );
    cardsToTilt.forEach(card => {
      if (!card.querySelector('.pi-glass-highlight')) {
        const highlight = document.createElement('div');
        highlight.className = 'pi-glass-highlight';
        card.appendChild(highlight);
      }

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.transform = 'translateY(-8px) scale(1.025)';
        card.style.boxShadow = '0 24px 48px rgba(12, 74, 64, 0.12), 0 6px 15px rgba(0, 0, 0, 0.03)';
        card.style.borderColor = 'rgba(24, 194, 156, 0.35)';

        const highlight = card.querySelector('.pi-glass-highlight');
        if (highlight) {
          highlight.style.opacity = '1';
          highlight.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 60%)`;
        }
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.boxShadow = '';
        card.style.borderColor = '';
        const highlight = card.querySelector('.pi-glass-highlight');
        if (highlight) highlight.style.opacity = '0';
      });
    });

    // Toggle body background blur on container hover
    document.querySelectorAll('#performance-intelligence > .read-only-box, .pi-kpi-card').forEach(item => {
      item.addEventListener('mouseenter', () => {
        document.body.classList.add('pi-dashboard-blur');
      });
      item.addEventListener('mouseleave', () => {
        document.body.classList.remove('pi-dashboard-blur');
      });
    });



    const tooltip = getTooltip();

    // Bar chart & team items tooltips
    document.querySelectorAll('.pi-bar-item, .pi-team-row').forEach(item => {
      item.addEventListener('mouseenter', () => {
        tooltip.textContent = item.dataset.detail;
        tooltip.style.opacity = '1';
      });
      item.addEventListener('mousemove', (e) => {
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY}px`;
      });
      item.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
    });

    // Click focused modal Mode
    document.querySelectorAll('#performance-intelligence > .read-only-box, .pi-kpi-card').forEach(card => {
      card.addEventListener('click', event => {
        // Prevent click if user clicks interactive ECharts segment/bar
        if (event.target.closest('.pi-bar-item, .pi-team-row') || event.target.tagName.toLowerCase() === 'path') return;
        
        document.body.classList.add('pi-modal-open');
        
        const backdrop = document.createElement('div');
        backdrop.className = 'pi-focus-backdrop';
        
        const title = card.querySelector('.pi-card-title span:first-child')?.textContent || 
                      card.querySelector('.pi-kpi-label')?.textContent || 
                      'Analytics Detail';
        
        const chartClone = card.cloneNode(true);
        // Clear all inline styles completely to prevent crooked rotation on the clone!
        chartClone.removeAttribute('style');
        chartClone.className = 'glass';
        chartClone.style.cssText = 'min-height:unset; cursor:default; box-shadow:none; border:none; background:none !important; backdrop-filter:none !important; width:100%; transform:none !important; transition:none !important;';
        
        const highlight = chartClone.querySelector('.pi-glass-highlight');
        if (highlight) highlight.remove();


        // Remove clone children that were mounted by ECharts since we will re-initialize them
        const cloneChartArea = chartClone.querySelector('#pi-workflow-donut, #pi-health-pie');
        if (cloneChartArea) {
          cloneChartArea.innerHTML = '';
          cloneChartArea.style.height = '200px';
        }
        
        const modal = document.createElement('div');
        modal.className = 'pi-focus-card';
        modal.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
            <div>
              <div style="font-size:12px;color:var(--text-muted);font-weight:900;text-transform:uppercase;letter-spacing:1px;">Performance Intelligence</div>
              <h3 style="font-size:28px;color:var(--text-dark);margin-top:4px;font-weight:800;">${title}</h3>
            </div>
            <button type="button" class="icon-btn pi-focus-close" style="width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-xmark" style="font-size:16px;"></i></button>
          </div>
          <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:24px;align-items:stretch;">
            <div class="pi-focus-chart-container" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.4);border-radius:24px;border:1px solid rgba(255,255,255,0.5);padding:20px;position:relative;"></div>
            <div style="display:flex;flex-direction:column;gap:14px;">
              <div class="read-only-box pi-legend-item" style="padding:14px;border-radius:16px;background:rgba(255,255,255,0.4);border:1px solid rgba(255,255,255,0.5);">
                <strong>Interactive Analytics</strong>
                <div style="font-size:12.5px;color:var(--text-muted);margin-top:6px;">Explore live metrics. Hover segments to inspect parameters.</div>
              </div>
              <div class="read-only-box pi-legend-item" style="padding:14px;border-radius:16px;background:rgba(255,255,255,0.4);border:1px solid rgba(255,255,255,0.5);">
                <strong>Performance Trend</strong>
                <div style="height:58px;margin-top:10px;background:linear-gradient(135deg,rgba(24, 194, 156, 0.15),rgba(139, 92, 246, 0.1));clip-path:polygon(0 80%,18% 62%,34% 68%,52% 35%,70% 48%,86% 20%,100% 32%,100% 100%,0 100%);border-radius:10px;"></div>
              </div>
              <div class="read-only-box pi-legend-item" style="padding:14px;border-radius:16px;background:rgba(255,255,255,0.4);border:1px solid rgba(255,255,255,0.5);">
                <strong>Achievement Status</strong>
                <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
                  <span class="status-pill progress" style="background:rgba(35, 184, 153, 0.1);color:var(--teal-900);padding:4px 8px;font-size:11px;font-weight:700;border-radius:6px;">✔ On Track</span>
                  <span class="status-pill progress" style="background:rgba(139, 92, 246, 0.1);color:var(--purple);padding:4px 8px;font-size:11px;font-weight:700;border-radius:6px;">✔ Verified</span>
                </div>
              </div>
            </div>
          </div>
        `;
        
        modal.querySelector('.pi-focus-chart-container').appendChild(chartClone);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Re-initialize ECharts instance inside cloned element
        let clonedChart = null;
        if (cloneChartArea) {
          const isWorkflow = cloneChartArea.id === 'pi-workflow-donut';
          
          // Re-draw ECharts inside clone using current data caches
          // Let's re-run drawDonutChart but targeting cloneChartArea
          if (isWorkflow) {
            clonedChart = drawDonutChart(cloneChartArea, [
              { label: 'Completed', value: parseInt(document.getElementById('kpi-val-completed')?.textContent || 0, 10), gradientFrom: '#18C29C', gradientTo: '#0FA87C' },
              { label: 'Running', value: 1, gradientFrom: '#4F8CFF', gradientTo: '#2563EB' },
              { label: 'Delayed', value: 0, gradientFrom: '#FF6B6B', gradientTo: '#E53935' },
              { label: 'Pending', value: 0, gradientFrom: '#FFB648', gradientTo: '#FF8B1F' }
            ], '1', 'flows', null);
          } else {
            const hVal = parseInt(document.getElementById('kpi-val-health')?.textContent || 100, 10);
            clonedChart = drawDonutChart(cloneChartArea, [
              { label: 'Healthy', value: hVal, gradientFrom: '#18C29C', gradientTo: '#0FA87C' },
              { label: 'Running', value: 0, gradientFrom: '#4F8CFF', gradientTo: '#2563EB' },
              { label: 'Delayed', value: 0, gradientFrom: '#FF6B6B', gradientTo: '#E53935' }
            ], `${hVal}%`, 'health', null);
          }
        }
        
        // Trigger backdrop and modal zoom/fade animations
        setTimeout(() => {
          backdrop.classList.add('active');
          if (clonedChart) clonedChart.resize();
        }, 50);

        const close = () => {
          backdrop.classList.remove('active');
          document.body.classList.remove('pi-modal-open');
          setTimeout(() => {
            if (clonedChart) clonedChart.dispose();
            backdrop.remove();
          }, 350);
          document.removeEventListener('keydown', escClose);
        };
        
        const escClose = e => {
          if (e.key === 'Escape') close();
        };
        
        backdrop.addEventListener('click', close);
        modal.querySelector('.pi-focus-close').addEventListener('click', close);
        modal.addEventListener('click', e => e.stopPropagation());
        document.addEventListener('keydown', escClose);
      });
    });
  };

  // Window resize callback to keep charts aligned and sharp
  window.addEventListener('resize', () => {
    chartInstances.forEach(c => {
      if (c) c.resize();
    });
  });

  fetch('/api/v1/admin/tasks/workflows', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      if (!data.success) throw new Error(data.message || 'Performance data load failed');
      render(data.data.workflows || []);
    })
    .catch(error => {
      console.error('Performance Intelligence load failed:', error);
      workflowDonut.innerHTML = '<span style="color:var(--text-muted);font-weight:800;">Unable to load</span>';
      barChart.innerHTML = '';
      healthPie.innerHTML = '';
      teamBars.innerHTML = '';
      teamList.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--text-muted);">Unable to load analytics</td></tr>';
    });
});
