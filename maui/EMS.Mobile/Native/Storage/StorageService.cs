namespace EMS.Mobile.Native.Storage;

public class StorageService
{
    public string GetCacheDirectory() => FileSystem.CacheDirectory;
    public string GetAppDataDirectory() => FileSystem.AppDataDirectory;

    public void SaveFile(string filename, string content)
    {
        var path = Path.Combine(FileSystem.AppDataDirectory, filename);
        File.WriteAllText(path, content);
    }

    public string? ReadFile(string filename)
    {
        var path = Path.Combine(FileSystem.AppDataDirectory, filename);
        return File.Exists(path) ? File.ReadAllText(path) : null;
    }
}
