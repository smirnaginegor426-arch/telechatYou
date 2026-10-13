export type CustomLanguageEntry = { source: string; translation: string };
export const CUSTOM_LANGUAGE_STORAGE_KEY = "tcy-custom-language-v1";
export const CUSTOM_LANGUAGE_EVENT = "tcy-custom-language-changed";

export const DEFAULT_LANGUAGE_ENTRIES: CustomLanguageEntry[] = [
  "Чаты","Люди","Профиль","Настройки","Поиск","Поиск чатов, людей, сообщений…","Новый чат","Архив","К чатам",
  "Пока нет чатов","Начните разговор","Найти людей","Повторить","Редактировать профиль","Редактировать","Сохранить",
  "Отмена","Закрыть","Назад","Ответить","Переслать","Копировать","Удалить","Имя","Имя пользователя","О себе",
  "Описание пользователя","Введите имя","Расскажите о себе","Написать сообщение","Сообщение удалено","Пользователь не найден",
  "Фото","Файл","Голосовое сообщение","Отправить","Отправка…","В сети","в сети","Тема","Тёмная тема","Светлая тема",
  "Тёмная","Светлая","Уведомления","Безопасность аккаунта","Приватность","Чаты и медиа","Данные","Хранилище","Мой язык",
  "Создать, изменить и сохранить свой язык","Системное обновление","О TeleChatYou","Выйти из аккаунта","Аккаунты",
  "Добавить или переключиться","Публичный канал","Приватный канал","Участник","Группа","Новые сообщения","Сменить обложку",
  "Обложка","Открыть фотографию","Создать опрос","Опубликовать опрос","Соединение","Обновление",
].map((source) => ({ source, translation: "" }));

export function loadCustomLanguageEntries(): CustomLanguageEntry[] {
  try {
    const raw = localStorage.getItem(CUSTOM_LANGUAGE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is CustomLanguageEntry =>
      !!entry && typeof entry === "object" &&
      "source" in entry && "translation" in entry &&
      typeof entry.source === "string" && typeof entry.translation === "string",
    );
  } catch {
    return [];
  }
}

export function loadCustomLanguageMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of loadCustomLanguageEntries()) {
    const source = entry.source.trim();
    const translation = entry.translation.trim();
    if (source && translation) map.set(source, translation);
  }
  return map;
}

export function saveCustomLanguageEntries(entries: CustomLanguageEntry[]) {
  const cleaned = entries
    .map((entry) => ({ source: entry.source.trim(), translation: entry.translation.trim() }))
    .filter((entry) => entry.source.length > 0);
  localStorage.setItem(CUSTOM_LANGUAGE_STORAGE_KEY, JSON.stringify(cleaned));
  window.dispatchEvent(new CustomEvent(CUSTOM_LANGUAGE_EVENT));
}
