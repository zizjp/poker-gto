const CACHE_NAME = "preflop-trainer-v1";

// インストール時
self.addEventListener("install", (event) => {
  // すぐに新しい SW を有効化できるようにする
  self.skipWaiting();
});

// 有効化時：古いキャッシュ削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 通信ハンドリング
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // GET 以外はそのまま
  if (request.method !== "GET") return;

  event.respondWith(
    // ネット優先
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        // 返ってきたレスポンスをキャッシュに保存
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => {
        // オフライン時など → キャッシュがあればそれを使う
        return caches.match(request);
      })
  );
});
