namespace EMS.Shared.Models;

public class OfflineQueueItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Endpoint { get; set; } = string.Empty;
    public string Method { get; set; } = "POST";
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
