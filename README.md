# NovaBlox – premium launcher do Roblox (Windows 10/11)

Electron · React · TypeScript · Tailwind CSS · Framer Motion · Lucide · Zustand

## Instalacja
Uruchom `NovaBlox-Setup-1.0.0.exe`. Instalator nie jest podpisany certyfikatem, więc Windows SmartScreen może pokazać ostrzeżenie:
kliknij **Więcej informacji → Uruchom mimo to**.

## Funkcje
| Sekcja | Co robi | Źródło danych |
|---|---|---|
| Logowanie | OAuth 2.0 + PKCE (oficjalne) albo połączenie publicznego profilu po nazwie | `apis.roblox.com/oauth`, `users.roblox.com` |
| Dashboard | Powitanie, duży avatar, PLAY (kontynuuj), ostatnio uruchomione, ulubione, popularne, aktywność, skróty | Roblox + lokalna historia |
| Discover | Popularne / Najczęściej grane / Nowe (listy Roblox Explore), gatunki (wyszukiwarka Roblox), wyszukiwanie, sortowanie | `explore-api`, `search-api`, `games.roblox.com` |
| My Games / Favorites | Biblioteka, wyszukiwanie, sortowanie, kategorie (gatunki Roblox), siatka/lista, dodawanie z linku, usuwanie z potwierdzeniem | lokalnie + odświeżane z Roblox |
| History | Oś czasu uruchomień z podziałem na dni, ponowne uruchomienie, czyszczenie | lokalnie |
| Strona gry | Galeria, opis, gracze online, odwiedziny, ocena, ulubione, rozmiar serwera, daty, Twoja aktywność | `games.roblox.com`, `thumbnails.roblox.com` |
| Profile | Avatar, nazwa, User ID, opis, znajomi, obserwujący, ulubione z Roblox, ostatnio grane, link do profilu, wylogowanie | `users`, `friends`, `thumbnails`, `games v2` |
| Settings | Autostart, minimalizacja, motywy, kolory, tła, styl i rozmiar kart, animacje, efekty, powiadomienia, cache, aktualizacje, informacje | — |

### Nowości w 1.1.0
- **Lista serwerów** na stronie gry: gracze, ping i FPS każdego serwera, dołączanie do konkretnego serwera oraz przyciski „Najmniej graczy” i „Najlepszy ping” (`games.roblox.com/v1/games/{placeId}/servers/Public` + `roblox://…&gameInstanceId=`).
- **Licznik czasu gry**: launcher co 5 s sprawdza proces `RobloxPlayerBeta.exe`. Sesje trafiają do historii, są wykres 7 dni i lista najdłużej granych gier.
- **Znajomi online** (`presence.roblox.com`): status online / w grze / w Studio. Nazwa gry pojawia się tylko wtedy, gdy Roblox ją udostępni.
- **Alerty aktualizacji** ulubionych gier: sprawdzane co 15 minut.
- **Mody Roblox**: własna czcionka i dźwięki (śmierć, skok, lądowanie, kroki). Pliki są kopiowane do `content/` z kopią oryginałów i jednym przyciskiem do przywrócenia.
- **Animowane tła**: zorza, gwiazdy, neonowa siatka oraz własne wideo MP4/WEBM.
- **Kopia zapasowa**: eksport i import danych do pliku JSON.
- **Wersja angielska**: Ustawienia → Ogólne → Język.

Gry uruchamiają się przez oficjalny link `roblox://experiences/start?placeId=…`, czyli w aplikacji Roblox, na koncie, które jest w niej zalogowane.

## Logowanie przez Roblox (OAuth) – konfiguracja
Roblox nie udostępnia publicznego logowania „dla wszystkich” bez rejestracji aplikacji. Trzeba raz utworzyć własną aplikację OAuth:
1. https://create.roblox.com/dashboard/credentials → **OAuth 2.0 Apps → Create**
2. Redirect URL: `http://localhost:47823/oauth/callback`
3. Uprawnienia (scopes): `openid`, `profile`
4. Skopiuj **Client ID** i wklej go w launcherze. Client Secret nie jest potrzebny (PKCE).

Ograniczenia: Roblox może wymagać weryfikacji konta twórcy i przeglądu aplikacji, zanim będą mogli z niej korzystać inni użytkownicy.
Bez Client ID możesz użyć połączenia **po nazwie użytkownika**. Pokazuje ono tylko publiczny profil i nie jest uwierzytelnieniem.

Bezpieczeństwo: launcher nigdy nie widzi hasła ani ciasteczka `.ROBLOSECURITY`. Tokeny OAuth są szyfrowane przez Windows DPAPI (`safeStorage`)
w pliku `session.bin`, a przy wylogowaniu są unieważniane w Roblox i usuwane.

## Uczciwe ograniczenia
- **„Ostatnio grane” i historia** pochodzą z launchera. Roblox nie udostępnia historii gier bez ciasteczka sesji, a z niego celowo nie korzystamy.
- **Explore i Search** to publiczne, ale nieudokumentowane endpointy Roblox. Launcher pobiera z nich tylko ID gier, a wszystkie statystyki czyta z udokumentowanego `games.roblox.com`.
  Jeśli Roblox nie publikuje danej listy (np. „Nowe gry”), launcher pokazuje to wprost, zamiast podstawiać dane.
- **Kategorie gatunkowe** (Horror, RPG, Obby…) to wyniki wyszukiwarki Roblox dla danej frazy, co jest zaznaczone w interfejsie.
- **Aktualizacje**: wpisz repozytorium GitHub w `package.json → novablox.updateRepo` (np. `"twojnick/novablox"`) i publikuj nowe wersje jako GitHub Releases.
  Bez tego przycisk „Sprawdź aktualizacje” informuje, że kanał nie jest skonfigurowany.
- **SQLite** nie był potrzebny. Dane są małe, więc trzymamy je w jednym pliku JSON z atomowym zapisem (`%APPDATA%\NovaBlox\novablox-state.json`).

## Praca z kodem
```bash
npm install
npm run dev        # tryb deweloperski z hot reload
npm run typecheck  # sprawdzenie typów
npm run dist       # build + instalator EXE (dist/NovaBlox-Setup-x.y.z.exe)
```

## Struktura
```
src/main/          proces główny
  index.ts         okno, IPC, autostart, powiadomienia, aktualizacje, cache
  auth.ts          OAuth 2.0 PKCE, sesja szyfrowana safeStorage, połączenie po nazwie
  roblox-api.ts    klient API Roblox (cache, ponawianie, timeouty)
  store.ts         trwały stan (JSON, zapis atomowy)
src/preload/       bezpieczny most window.nova (contextIsolation)
src/shared/        typy wspólne
src/renderer/src/
  App.tsx          splash, aktualizacje, routing, przejścia
  store/           Zustand: stan aplikacji, toasty, potwierdzenia
  components/      Shell (pasek tytułu, menu, powiadomienia, offline), karty gier, overlaye, UI kit
  pages/           Connect, Dashboard, Discover, Library, History, GameDetails, Profile, Settings
  lib/             motywy, formatowanie, hooki danych
```

NovaBlox to niezależny projekt fanowski, niepowiązany z Roblox Corporation.
