using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

namespace EMS.Shared.Services
{
    /// <summary>
    /// Enterprise Task Assignment & Handover Service for .NET MAUI
    /// Handles mobile & desktop ownership transfers, delegation, returns, escalations, and manager approvals.
    /// </summary>
    public class TaskHandoverService
    {
        private readonly HttpClient _httpClient;
        private readonly ConnectivityService _connectivity;

        public TaskHandoverService(HttpClient httpClient, ConnectivityService connectivity)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _connectivity = connectivity;
        }

        /// <summary>
        /// Initiates a task handover / transfer request.
        /// </summary>
        public async Task<bool> InitiateTransferAsync(int taskId, string transferType, int toEmployeeId, string reasonCode, string reasonDescription, bool requiresApproval = false, DateTime? expiryAt = null)
        {
            try
            {
                var payload = new
                {
                    taskId = taskId,
                    transferType = transferType,
                    toEmployeeId = toEmployeeId,
                    reasonCode = reasonCode,
                    reasonDescription = reasonDescription,
                    requiresApproval = requiresApproval,
                    expiryAt = expiryAt?.ToString("o")
                };

                var response = await _httpClient.PostAsJsonAsync("/api/v1/task-handover/transfer", payload);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Handover] Error transferring task: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Responds to a manager transfer approval request (Approve or Reject).
        /// </summary>
        public async Task<bool> RespondToApprovalAsync(int approvalId, string status, string comments = "")
        {
            try
            {
                var payload = new
                {
                    approvalId = approvalId,
                    status = status, // "Approved" or "Rejected"
                    comments = comments
                };

                var response = await _httpClient.PostAsJsonAsync("/api/v1/task-handover/approvals/respond", payload);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Handover] Approval error: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Fetches pending transfer approvals for current manager.
        /// </summary>
        public async Task<JsonElement?> GetPendingApprovalsAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/api/v1/task-handover/approvals/pending");
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<JsonElement>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Handover] Pending approvals error: {ex.Message}");
            }
            return null;
        }

        /// <summary>
        /// Fetches immutable task timeline audit trail.
        /// </summary>
        public async Task<JsonElement?> GetTaskTimelineAsync(int taskId)
        {
            try
            {
                var response = await _httpClient.GetAsync($"/api/v1/task-handover/{taskId}/timeline");
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<JsonElement>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Handover] Timeline error: {ex.Message}");
            }
            return null;
        }
    }
}
