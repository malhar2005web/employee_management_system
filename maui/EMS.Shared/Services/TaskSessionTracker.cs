using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace EMS.Shared.Services
{
    /// <summary>
    /// Enterprise Task Session Tracking Service for .NET MAUI (Desktop & Mobile)
    /// Enforces single active task rule, background heartbeat, and automatic task switching.
    /// </summary>
    public class TaskSessionTracker
    {
        private readonly HttpClient _httpClient;
        private readonly ConnectivityService _connectivity;
        private Timer _heartbeatTimer;
        private int? _activeSessionId;
        private readonly string _platform;

        public bool IsTrackingActive => _activeSessionId.HasValue;
        public int? ActiveSessionId => _activeSessionId;

        public TaskSessionTracker(HttpClient httpClient, ConnectivityService connectivity, string platform = "Desktop")
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _connectivity = connectivity;
            _platform = platform;
        }

        /// <summary>
        /// Starts a new task session. Automatically pauses any previously active task with 'Task Switched' status.
        /// </summary>
        public async Task<bool> StartTaskSessionAsync(int taskId, int? projectId = null)
        {
            try
            {
                var payload = new
                {
                    taskId = taskId,
                    projectId = projectId,
                    platform = _platform
                };

                var response = await _httpClient.PostAsJsonAsync("/api/v1/tracking/start", payload);
                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<JsonElement>();
                    if (result.TryGetProperty("data", out var data) && data.TryGetProperty("session", out var session))
                    {
                        _activeSessionId = session.GetProperty("id").GetInt32();
                        StartHeartbeatLoop();
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Tracker] Error starting session: {ex.Message}");
            }
            return false;
        }

        /// <summary>
        /// Pauses the current active task session.
        /// </summary>
        public async Task<bool> PauseTaskSessionAsync(string reason = "Employee Paused")
        {
            try
            {
                var response = await _httpClient.PostAsJsonAsync("/api/v1/tracking/pause", new { reason });
                if (response.IsSuccessStatusCode)
                {
                    StopHeartbeatLoop();
                    _activeSessionId = null;
                    return true;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Tracker] Error pausing session: {ex.Message}");
            }
            return false;
        }

        /// <summary>
        /// Completes the active task session and marks the task as completed.
        /// </summary>
        public async Task<bool> CompleteTaskSessionAsync()
        {
            try
            {
                var response = await _httpClient.PostAsJsonAsync("/api/v1/tracking/stop", new { endReason = "Task Completed", isTaskCompleted = true });
                if (response.IsSuccessStatusCode)
                {
                    StopHeartbeatLoop();
                    _activeSessionId = null;
                    return true;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Tracker] Error completing session: {ex.Message}");
            }
            return false;
        }

        private void StartHeartbeatLoop()
        {
            StopHeartbeatLoop();
            _heartbeatTimer = new Timer(async _ => await SendHeartbeatAsync(), null, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30));
        }

        private void StopHeartbeatLoop()
        {
            _heartbeatTimer?.Dispose();
            _heartbeatTimer = null;
        }

        private async Task SendHeartbeatAsync()
        {
            if (!_activeSessionId.HasValue) return;

            try
            {
                var payload = new
                {
                    sessionId = _activeSessionId.Value,
                    platform = _platform,
                    activeWindow = "EMS Native App"
                };

                await _httpClient.PostAsJsonAsync("/api/v1/tracking/heartbeat", payload);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Tracker] Heartbeat ping failed: {ex.Message}");
            }
        }
    }
}
