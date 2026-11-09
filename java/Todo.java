import java.util.ArrayList;
import java.util.List;

public class Todo {

    public static List<Task> addTask(List<Task> tasks, String title, String id) {
        List<Task> result = new ArrayList<>(tasks);
        String trimmed = title.trim();
        if (trimmed.isEmpty()) return result;
        result.add(new Task(id, trimmed, false));
        return result;
    }

    public static List<Task> toggleTask(List<Task> tasks, String id) {
        List<Task> result = new ArrayList<>();
        for (Task t : tasks) {
            result.add(t.id().equals(id) ? new Task(t.id(), t.title(), !t.done()) : t);
        }
        return result;
    }

    public static List<Task> removeTask(List<Task> tasks, String id) {
        List<Task> result = new ArrayList<>();
        for (Task t : tasks) {
            if (!t.id().equals(id)) result.add(t);
        }
        return result;
    }

    public static int countPending(List<Task> tasks) {
        int count = 0;
        for (Task t : tasks) {
            if (!t.done()) count++;
        }
        return count;
    }

    public static String pendingLabel(int count) {
        return count == 1 ? "tarefa pendente" : "tarefas pendentes";
    }
}
