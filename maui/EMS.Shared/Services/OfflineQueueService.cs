using System.Text.Json;
using EMS.Shared.Models;
using EMS.Shared.Api;

namespace EMS.Shared.Services;

public class OfflineQueueService
{
    private readonly ConnectivityService _connectivityService;
    private readonly ApiClient _apiClient;
    private readonly string _queueFilePath;
    private readonly object _fileLock = new();
    private bool _isSyncing = false;

    public OfflineQueueService(ConnectivityService connectivityService, ApiClient apiClient)
    {
        _connectivityService = connectivityService;
        _apiClient = apiClient;
        _queueFilePath = Path.Combine(FileSystem.AppDataDirectory, "offline_queue.json");

        _connectivityService.ConnectivityChanged += OnConnectivityChanged;
        
        // Initial sync check
        if (_connectivityService.IsConnected)
        {
            Task.Run(SyncQueueAsync);
        }
    }

    private void OnConnectivityChanged(object? sender, bool isConnected)
    {
        if (isConnected)
        {
            Task.Run(SyncQueueAsync);
        }
    }

    public async Task EnqueueRequestAsync<T>(string endpoint, string method, T data)
    {
        var item = new OfflineQueueItem
        {
            Endpoint = endpoint,
            Method = method,
            PayloadJson = JsonSerializer.Serialize(data)
        };

        lock (_fileLock)
        {
            var queue = LoadQueue();
            queue.Add(item);
            SaveQueue(queue);
        }

        if (_connectivityService.IsConnected)
        {
            await SyncQueueAsync();
        }
    }

    public async Task SyncQueueAsync()
    {
        if (_isSyncing || !_connectivityService.IsConnected)
            return;

        _isSyncing = true;
        try
        {
            List<OfflineQueueItem> items;
            lock (_fileLock)
            {
                items = LoadQueue();
            }

            if (items.Count == 0)
                return;

            var successfullySyncedIds = new List<string>();

            foreach (var item in items.OrderBy(x => x.Timestamp))
            {
                if (!_connectivityService.IsConnected)
                    break;

                try
                {
                    HttpResponseMessage response;
                    var content = new StringContent(item.PayloadJson, System.Text.Encoding.UTF8, "application/json");
                    
                    if (item.Method == "POST")
                    {
                        response = await _apiClient.PostAsync(item.Endpoint, content); 
                    }
                    else if (item.Method == "PUT")
                    {
                        response = await _apiClient.PutAsync(item.Endpoint, content);
                    }
                    else
                    {
                        continue; 
                    }

                    if (response.IsSuccessStatusCode)
                    {
                        successfullySyncedIds.Add(item.Id);
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Error syncing item {item.Id}: {ex.Message}");
                    break;
                }
            }

            if (successfullySyncedIds.Count > 0)
            {
                lock (_fileLock)
                {
                    var queue = LoadQueue();
                    queue.RemoveAll(x => successfullySyncedIds.Contains(x.Id));
                    SaveQueue(queue);
                }
            }
        }
        finally
        {
            _isSyncing = false;
        }
    }

    private List<OfflineQueueItem> LoadQueue()
    {
        if (!File.Exists(_queueFilePath))
            return new List<OfflineQueueItem>();

        try
        {
            var json = File.ReadAllText(_queueFilePath);
            return JsonSerializer.Deserialize<List<OfflineQueueItem>>(json) ?? new List<OfflineQueueItem>();
        }
        catch
        {
            return new List<OfflineQueueItem>();
        }
    }

    private void SaveQueue(List<OfflineQueueItem> queue)
    {
        try
        {
            var json = JsonSerializer.Serialize(queue);
            File.WriteAllText(_queueFilePath, json);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to save offline queue: {ex.Message}");
        }
    }
}
