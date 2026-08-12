(function() {
    let nextCallbackId = 1;
    const pendingCallbacks = new Map();

    window.EMS = window.EMS || {};
    window.EMS.version = "1.0";
    
    window.EMS.Native = {
        invoke: function(methodName, args = {}) {
            return new Promise((resolve, reject) => {
                const callbackId = nextCallbackId++;
                pendingCallbacks.set(callbackId, { resolve, reject });

                const payload = {
                    method: methodName,
                    callbackId: callbackId,
                    args: args
                };
                
                const bridgeUrl = "ems-bridge://" + encodeURIComponent(JSON.stringify(payload));
                
                const iframe = document.createElement("iframe");
                iframe.style.display = "none";
                iframe.src = bridgeUrl;
                document.body.appendChild(iframe);
                setTimeout(() => iframe.remove(), 100);
            });
        },

        resolveCallback: function(callbackId, success, resultJson) {
            const promise = pendingCallbacks.get(callbackId);
            if (promise) {
                pendingCallbacks.delete(callbackId);
                let result = resultJson;
                if (typeof resultJson === "string") {
                    try {
                        result = JSON.parse(resultJson);
                    } catch(e) {}
                }
                
                if (success) {
                    promise.resolve(result);
                } else {
                    promise.reject(result);
                }
            }
        },

        pickImage: function() {
            return this.invoke("pickImage");
        },
        capturePhoto: function() {
            return this.invoke("capturePhoto");
        },
        location: function() {
            return this.invoke("location");
        },
        notification: function(title, message) {
            return this.invoke("notification", { title, message });
        },
        uploadFile: function(filePath) {
            return this.invoke("uploadFile", { filePath });
        },
        exit: function() {
            return this.invoke("exit");
        }
    };
})();
