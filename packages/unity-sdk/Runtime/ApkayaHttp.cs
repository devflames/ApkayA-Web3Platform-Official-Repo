using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;

namespace Apkaya.UnitySdk
{
    public sealed class ApkayaConfig
    {
        public string EngineBaseUrl { get; set; } = "http://localhost:3005";
        public string ApiKey { get; set; } = "";
        public string InsightBaseUrl { get; set; } = "http://localhost:3006";

        public string NormalizedEngineUrl => EngineBaseUrl.TrimEnd('/');
        public string NormalizedInsightUrl => string.IsNullOrWhiteSpace(InsightBaseUrl)
            ? InferInsightUrl(EngineBaseUrl)
            : InsightBaseUrl.TrimEnd('/');

        private static string InferInsightUrl(string engineUrl)
        {
            if (Uri.TryCreate(engineUrl, UriKind.Absolute, out var uri))
            {
                var port = uri.Port == 3005 || uri.Port <= 0 ? 3006 : uri.Port;
                var builder = new UriBuilder(uri) { Port = port };
                return builder.Uri.GetLeftPart(UriPartial.Authority);
            }
            return "http://localhost:3006";
        }
    }

    public sealed class ApkayaHttpException : Exception
    {
        public long StatusCode { get; }
        public ApkayaHttpException(long statusCode, string message) : base(message)
        {
            StatusCode = statusCode;
        }
    }

    internal static class ApkayaHttp
    {
        public static async Task<T> RequestAsync<T>(
            ApkayaConfig config,
            string baseUrl,
            string path,
            string method = "GET",
            object body = null,
            Dictionary<string, string> extraHeaders = null)
        {
            var url = $"{baseUrl.TrimEnd('/')}{path}";
            using var request = new UnityWebRequest(url, method);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Authorization", $"Bearer {config.ApiKey}");
            request.SetRequestHeader("Content-Type", "application/json");

            if (extraHeaders != null)
            {
                foreach (var kv in extraHeaders)
                    request.SetRequestHeader(kv.Key, kv.Value);
            }

            if (body != null && method != UnityWebRequest.kHttpVerbGET)
            {
                var json = JsonConvert.SerializeObject(body);
                request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            }

            var op = request.SendWebRequest();
            while (!op.isDone)
                await Task.Yield();

#if UNITY_2020_1_OR_NEWER
            if (request.result != UnityWebRequest.Result.Success)
#else
            if (request.isNetworkError || request.isHttpError)
#endif
            {
                var errBody = request.downloadHandler?.text ?? "";
                string message = errBody;
                try
                {
                    var parsed = JObject.Parse(errBody);
                    message = parsed["error"]?.ToString() ?? message;
                }
                catch { /* ignore */ }
                throw new ApkayaHttpException(request.responseCode, message);
            }

            var text = request.downloadHandler.text;
            var envelope = JObject.Parse(string.IsNullOrEmpty(text) ? "{}" : text);
            var result = envelope["result"];
            if (result == null)
                return default;

            if (typeof(T) == typeof(JToken))
                return (T)(object)result;

            return result.ToObject<T>();
        }
    }
}
