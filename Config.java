import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** ~/.config/todo-list/config: KEY=value lines. Elf Desk writes it from the settings in elf.yaml. */
public class Config {

    static final Path DIR = Path.of(System.getProperty("user.home"), ".config", "todo-list");
    static final Path FILE = DIR.resolve("config");
    static final Pattern LOGIN = Pattern.compile("[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})");
    static final Pattern REPO = Pattern.compile("[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}");

    String githubLogin;
    /** The repos it may suggest, create issues in and clone for the AI: only these, whatever a todo says. */
    List<String> repos = new ArrayList<>();
    int dueSoonDays;
    int keepDoneDays;

    static Config load() throws IOException {
        Map<String, String> raw = new HashMap<>();
        if (Files.exists(FILE)) {
            for (String line : Files.readAllLines(FILE)) {
                line = line.strip();
                int eq = line.indexOf('=');
                if (!line.startsWith("#") && eq > 0) raw.putIfAbsent(line.substring(0, eq).strip(), line.substring(eq + 1).strip());
            }
        }
        Config c = new Config();
        c.githubLogin = raw.getOrDefault("GITHUB_LOGIN", "");
        if (!c.githubLogin.isEmpty() && !LOGIN.matcher(c.githubLogin).matches()) throw new IllegalStateException("Set your GitHub account in todo-list's settings on the desk");
        for (String r : raw.getOrDefault("REPOS", "").split(",")) {
            r = r.strip();
            if (REPO.matcher(r).matches() && c.repos.stream().noneMatch(r::equalsIgnoreCase)) c.repos.add(r);
        }
        c.dueSoonDays = number(raw.get("DUE_SOON_DAYS"), 2);
        c.keepDoneDays = number(raw.get("KEEP_DONE_DAYS"), 30);
        return c;
    }

    static int number(String s, int dflt) {
        try {
            return s == null || s.isBlank() ? dflt : Math.max(0, Integer.parseInt(s.strip()));
        } catch (NumberFormatException e) {
            return dflt;
        }
    }

    /** The one of your repos that matches, as you wrote it, or null: nothing else is ever used. */
    String repo(String name) {
        return name == null ? null : repos.stream().filter(name::equalsIgnoreCase).findFirst().orElse(null);
    }
}
