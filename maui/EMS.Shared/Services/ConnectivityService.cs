namespace EMS.Shared.Services;

public class ConnectivityService
{
    public bool IsConnected => Connectivity.Current.NetworkAccess == NetworkAccess.Internet;

    public event EventHandler<bool>? ConnectivityChanged;

    public ConnectivityService()
    {
        Connectivity.Current.ConnectivityChanged += OnConnectivityChanged;
    }

    private void OnConnectivityChanged(object? sender, ConnectivityChangedEventArgs e)
    {
        ConnectivityChanged?.Invoke(this, e.NetworkAccess == NetworkAccess.Internet);
    }
}
