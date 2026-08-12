using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using EMS.Shared.Constants;
using EMS.Shared.Models;
using EMS.Shared.Storage;

namespace EMS.Shared.Api;

public class TokenRefreshHandler : DelegatingHandler
{
    private readonly SemaphoreSlim _refreshSemaphore = new(1, 1);

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var token = await SecureStorageManager.GetTokenAsync();
        if (!string.IsNullOrEmpty(token))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        var response = await base.SendAsync(request, cancellationToken);

        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            var isRefreshed = await TryRefreshTokenAsync();
            if (isRefreshed)
            {
                token = await SecureStorageManager.GetTokenAsync();
                if (!string.IsNullOrEmpty(token))
                {
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                }

                response.Dispose();
                response = await base.SendAsync(request, cancellationToken);
            }
        }

        return response;
    }

    private async Task<bool> TryRefreshTokenAsync()
    {
        await _refreshSemaphore.WaitAsync();
        try
        {
            var currentToken = await SecureStorageManager.GetTokenAsync();
            if (string.IsNullOrEmpty(currentToken))
                return false;

            using var client = new HttpClient();
            client.BaseAddress = new Uri(ApiConstants.ApiBaseUrl);
            
            client.DefaultRequestHeaders.Add("X-EMS-Client", DeviceInfo.Idiom == DeviceIdiom.Phone ? "Mobile" : "Desktop");
            client.DefaultRequestHeaders.Add("X-EMS-Platform", DeviceInfo.Platform.ToString());
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", currentToken);

            var refreshResponse = await client.PostAsync(ApiConstants.RefreshEndpoint, null);
            if (refreshResponse.IsSuccessStatusCode)
            {
                var content = await refreshResponse.Content.ReadAsStringAsync();
                var loginResponse = JsonSerializer.Deserialize<LoginResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (loginResponse != null && !string.IsNullOrEmpty(loginResponse.Token))
                {
                    await SecureStorageManager.SaveTokenAsync(loginResponse.Token);
                    return true;
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Token refresh failed: {ex.Message}");
        }
        finally
        {
            _refreshSemaphore.Release();
        }

        SecureStorageManager.ClearAuth();
        return false;
    }
}
