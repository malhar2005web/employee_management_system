using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

namespace EMS.Shared.Services
{
    /// <summary>
    /// Enterprise Chat Channels, Presence & @Mention Service for .NET MAUI
    /// Handles Direct Messages, Task Groups, Department Channels, Threads, and @mention push alerts.
    /// </summary>
    public class EnterpriseChatService
    {
        private readonly HttpClient _httpClient;
        private readonly ConnectivityService _connectivity;

        public EnterpriseChatService(HttpClient httpClient, ConnectivityService connectivity)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _connectivity = connectivity;
        }

        /// <summary>
        /// Fetches 3 channel modes (Direct Messages with presence, Task Groups, Department Channels).
        /// </summary>
        public async Task<JsonElement?> GetChannelsAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/api/v1/chat/channels");
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<JsonElement>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Chat] Error fetching channels: {ex.Message}");
            }
            return null;
        }

        /// <summary>
        /// Fetches thread messages for a specific channel.
        /// </summary>
        public async Task<JsonElement?> GetChannelMessagesAsync(int channelId)
        {
            try
            {
                var response = await _httpClient.GetAsync($"/api/v1/chat/messages/{channelId}");
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<JsonElement>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Chat] Error fetching messages: {ex.Message}");
            }
            return null;
        }

        /// <summary>
        /// Sends message with @mentions and attachments.
        /// </summary>
        public async Task<bool> SendMessageAsync(int channelId, string messageText, int? replyToMessageId = null)
        {
            try
            {
                var payload = new
                {
                    channelId,
                    messageText,
                    replyToMessageId
                };

                var response = await _httpClient.PostAsJsonAsync("/api/v1/chat/messages", payload);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAUI Chat] Error sending message: {ex.Message}");
                return false;
            }
        }
    }
}
