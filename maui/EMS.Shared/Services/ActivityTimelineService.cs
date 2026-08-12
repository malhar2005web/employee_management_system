using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

namespace EMS.Shared.Services
{
    /// <summary>
    /// Enterprise Activity Timeline, Audit Trail & Performance Intelligence Service for .NET MAUI
    /// Handles mobile & desktop timeline streams, step performance cards, story replay playback, and audit exports.
    /// </summary>
    public class ActivityTimelineService
    {
        private readonly HttpClient _httpClient;
        private readonly ConnectivityService _connectivity;

        public ActivityTimelineService(HttpClient httpClient, ConnectivityService connectivity)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _connectivity = connectivity;
        }

        /// <summary>
        /// Fetches chronological timeline events with optional module/category filters.
        /// </summary>
        public async Task<JsonElement?> GetTimelineEventsAsync(string category = null, string moduleName = null, string search = null)
        {
            try
            {
                var queryParams = new List<string>();
                if (!string.IsNullOrEmpty(category)) queryParams.Add($"category={Uri.EscapeDataString(category)}");
                if (!string.IsNullOrEmpty(moduleName)) queryParams.Add($"module={Uri.EscapeDataString(moduleName)}");
                if (!string.IsNullOrEmpty(search)) queryParams.Add($"search={Uri.EscapeDataString(search)}");

                var url = "/api/v1/timeline/events" + (queryParams.Count > 0 ? "?" + string.Join("&", queryParams) : "");
                var response = await _httpClient.GetAsync(url);

                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<JsonElement>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Timeline] Error fetching timeline events: {ex.Message}");
            }
            return null;
        }

        /// <summary>
        /// Fetches compact performance metrics card for a specific workflow step or task.
        /// </summary>
        public async Task<JsonElement?> GetStepPerformanceAsync(int stepId)
        {
            try
            {
                var response = await _httpClient.GetAsync($"/api/v1/timeline/step-performance/{stepId}");
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<JsonElement>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Timeline] Error fetching step performance: {ex.Message}");
            }
            return null;
        }

        /// <summary>
        /// Fetches task story replay sequence (▶ Playback).
        /// </summary>
        public async Task<JsonElement?> GetTaskPlaybackTimelineAsync(int taskId)
        {
            try
            {
                var response = await _httpClient.GetAsync($"/api/v1/timeline/playback/{taskId}");
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<JsonElement>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Timeline] Error fetching playback timeline: {ex.Message}");
            }
            return null;
        }
    }
}
