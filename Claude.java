import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Claude for an elf, locked down: what it reads includes other people's words (here, a todo someone asked of you), so
 * it gets no tools (built in or MCP), none of your settings, and an empty folder of its own. Its answer is only text,
 * for the elf to check and save; it can't do anything.
 */
public class Claude {

    /** Claude's answer to the prompt, or null (and why, on stderr) if it failed. */
    static String ask(String prompt, int minutes) {
        return run(List.of(), prompt, minutes);
    }

    /**
     * Claude's answer as the JSON the schema describes (its structured output), or null (and why, on stderr) if it
     * failed or gave none.
     */
    static JsonNode askJson(String prompt, String schema, int minutes) {
        String out = run(List.of("--output-format", "json", "--json-schema", schema), prompt, minutes);
        if (out == null) return null;
        try {
            JsonNode n = new ObjectMapper().readTree(out).path("structured_output");
            if (n.isObject()) return n;
            System.err.println("Claude gave no answer in the shape asked for");
        } catch (Exception e) {
            System.err.println("Claude's answer wasn't JSON: " + e.getMessage());
        }
        return null;
    }

    static String run(List<String> extra, String prompt, int minutes) {
        try {
            List<String> cmd = new ArrayList<>(List.of("claude", "-p", "--model", "sonnet", "--tools", "", "--strict-mcp-config",
                    "--setting-sources", ""));
            cmd.addAll(extra);
            Process p = new ProcessBuilder(cmd).directory(Files.createTempDirectory("elf-claude-").toFile()).start();
            CompletableFuture<String> out = CompletableFuture.supplyAsync(() -> read(p.getInputStream()));
            CompletableFuture<String> err = CompletableFuture.supplyAsync(() -> read(p.getErrorStream()));
            try (var os = p.getOutputStream()) {
                os.write(prompt.getBytes(StandardCharsets.UTF_8));
            }
            if (!p.waitFor(minutes, TimeUnit.MINUTES)) {
                p.destroyForcibly();
                System.err.println("Claude took too long");
                return null;
            }
            if (p.exitValue() != 0) {
                System.err.println("Claude failed: " + err.get(10, TimeUnit.SECONDS).strip());
                return null;
            }
            return out.get(10, TimeUnit.SECONDS).strip();
        } catch (Exception e) {
            System.err.println("Claude error: " + e.getMessage());
            return null;
        }
    }

    static String read(InputStream in) {
        try {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "";
        }
    }
}
