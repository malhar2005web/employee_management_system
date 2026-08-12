using System.Net.Http.Json;
using System.Text.Json;
using EMS.Shared.Constants;

namespace EMS.Shared.Api;

public class ApiClient
{
    private readonly HttpClient _client;

    public ApiClient()
    {
        var handler = new TokenRefreshHandler
        {
            InnerHandler = new HttpClientHandler()
        };

        _client = new HttpClient(handler)
        {
            BaseAddress = new Uri(ApiConstants.ApiBaseUrl)
        };

        _client.DefaultRequestHeaders.Add("X-EMS-Client", DeviceInfo.Idiom == DeviceIdiom.Phone ? "Mobile" : "Desktop");
        _client.DefaultRequestHeaders.Add("X-EMS-Platform", DeviceInfo.Platform.ToString());
    }

    public async Task<HttpResponseMessage> GetAsync(string endpoint)
    {
        return await _client.GetAsync(endpoint);
    }

    public async Task<T?> GetFromJsonAsync<T>(string endpoint)
    {
        try
        {
            return await _client.GetFromJsonAsync<T>(endpoint);
        }
        catch
        {
            return default;
        }
    }

    public async Task<HttpResponseMessage> PostAsync<T>(string endpoint, T data)
    {
        return await _client.PostAsJsonAsync(endpoint, data);
    }

    public async Task<HttpResponseMessage> PostAsync(string endpoint, HttpContent content)
    {
        return await _client.PostAsync(endpoint, content);
    }

    public async Task<HttpResponseMessage> PutAsync<T>(string endpoint, T data)
    {
        return await _client.PutAsJsonAsync(endpoint, data);
    }

    public async Task<HttpResponseMessage> PutAsync(string endpoint, HttpContent content)
    {
        return await _client.PutAsync(endpoint, content);
    }

    public async Task<HttpResponseMessage> DeleteAsync(string endpoint)
    {
        return await _client.DeleteAsync(endpoint);
    }
}
