# TeleChatYou для Android — сборка APK через GitHub Actions

Это Android WebView-оболочка для опубликованной веб-версии:

https://telechatyou-1.onrender.com/

Приложение отображает веб-мессенджер из интернета. Интернет-соединение и работа сервера Render необходимы. Это не полностью нативный Android-клиент и не включает сервер или секреты базы данных в APK.

## Как собрать APK без Android Studio

1. Скачайте и распакуйте `TeleChatYou-Android-Builder.zip` в папку `Downloads\TeleChatYou-Android-Builder`.
2. Откройте PowerShell в репозитории `telechatYou` или в любом другом каталоге.
3. Выполните установочный скрипт, который аккуратно копирует Android-проект и workflow в существующий репозиторий, не удаляя другие GitHub Actions:

   ```powershell
   powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\TeleChatYou-Android-Builder\install-to-repo.ps1" -RepoPath "$HOME\Downloads\telechatYou"
   ```

   Если ZIP распакован в другую папку, исправьте путь к `install-to-repo.ps1`. Скрипт не копирует `.env`, пароли или ключи TiDB.
4. Перейдите в репозиторий и проверьте изменения:

   ```powershell
   cd "$HOME\Downloads\telechatYou"
   git status --short
   ```

5. Добавьте Android-проект и workflow, затем отправьте их на GitHub:

   ```powershell
   git add android .github/workflows/build-telechatyou-apk.yml README-APK.md .gitignore
   git commit -m "Add Android APK builder"
   git push origin main
   ```

6. На GitHub откройте репозиторий `telechatYou` → вкладку **Actions** → workflow **Build TeleChatYou Android APK**.
7. Откройте самый свежий запуск. Дождитесь зелёной галочки **Success**.
8. Внизу страницы запуска, в разделе **Artifacts**, скачайте **TeleChatYou-APK** и распакуйте скачанный ZIP. Внутри находится `app-debug.apk`.
9. Передайте `app-debug.apk` на Android-телефон, откройте его и подтвердите установку из этого источника, если Android спросит.

Workflow запускается автоматически при изменениях в `android/` или файле workflow. Его также можно запустить вручную из вкладки Actions через **Run workflow**.

## Что умеет оболочка

- открывает опубликованный TeleChatYou в WebView;
- сохраняет cookies авторизации между запусками;
- поддерживает выбор файлов для прикрепления;
- запрашивает разрешение на микрофон только для домена TeleChatYou;
- поддерживает скачивание файлов, если сервер отдаёт их по HTTPS;
- оставляет внешние HTTP(S)-ссылки, телефонные и email-ссылки для соответствующих приложений.

## Примечания

- Первый запуск GitHub Actions может занять несколько минут, пока скачиваются Android SDK, Gradle и зависимости.
- GitHub Actions выдаёт отладочный (`debug`) APK, подписанный автоматически для тестовой установки. Это подходит для установки напрямую на свой телефон и тестирования; для Google Play потребуется отдельная release-сборка и собственная подпись.
- Установщик не содержит `DATABASE_URL`, `SESSION_SECRET` или иных секретов. Эти данные должны оставаться только в переменных окружения сервера Render.
