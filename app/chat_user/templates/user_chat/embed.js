(function () {
  var config = {
    chatServerUrl: "{{ chat_server_url|escapejs }}",
    staticFilesUrl: "{{ static_url|escapejs }}",
    chatTemplateUrl: "{{ chat_server_url }}/chat_user/widget",
    csrfToken: "{{ csrf_token }}",
  };

  function getCookie(name) {
  let match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
  }

  var container = document.createElement("div");
  container.id = "embedded-chat-widget";
  document.body.appendChild(container);


  var cssFiles = [
    "https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.1.3/css/bootstrap.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css",
    config.staticFilesUrl + "chat_user/css/animation.css",
    config.staticFilesUrl + "chat_user/css/chat.css",
    config.staticFilesUrl + "chat_user/css/message.css",
  ];

  cssFiles.forEach(function (url) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  });


//  var jsHeadFiles = [
//    config.staticFilesUrl + "chat_user/js/apiFetch.js",
//  ];
//
//  jsHeadFiles.forEach(function (url) {
//    var script = document.createElement("script");
//    script.src = url;
//    script.type = "text/javascript";
//    script.defer = true;
//    document.head.appendChild(script);
//  });

  var jsFiles = [
    "https://unpkg.com/jwt-decode@3.1.2/build/jwt-decode.js",
    config.staticFilesUrl + "chat_user/js/consts.js",
    config.staticFilesUrl + "chat_user/js/utils.js",
    config.staticFilesUrl + "chat_user/js/message.js",
    config.staticFilesUrl + "chat_user/js/answer.js",
    config.staticFilesUrl + "chat_user/js/dialog.js",
    config.staticFilesUrl + "chat_user/js/session.js",
    config.staticFilesUrl + "chat_user/js/menu.js",
    config.staticFilesUrl + "chat_user/js/chat_new.js",
  ];

  if (document.readyState !== "complete") {
    document.addEventListener("DOMContentLoaded", async () => {
      await initializeChat();
      await loadAllScripts();
    });
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function loadAllScripts() {
    try {
      for (let i = 0; i < jsFiles.length; i++) {
        await loadScript(jsFiles[i]);
      }
    } catch (error) {
      console.error("Script loading failed:", error);
    }
  }

  async function initializeChat() {
    try {
      const csrfToken = getCookie("csrftoken"); // 🔹 Используем свежий токен из куки
      console.log("CSRF-токен из куки:", csrfToken);
      const response = await fetch(config.chatTemplateUrl, {
        headers: {
            "Accept": "text/html",
            "X-CSRFToken": csrfToken,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const html = await response.text();
      container.innerHTML = html;
    } catch (error) {
      console.log(error);
    }
  }
})();