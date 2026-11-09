import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class TodoTest {

    @Test
    void addTaskAppendsATask() {
        List<Task> tasks = Todo.addTask(List.of(), "Estudar", "1");
        assertEquals(1, tasks.size());
        assertEquals("Estudar", tasks.get(0).title());
        assertFalse(tasks.get(0).done());
    }

    @Test
    void addTaskIgnoresBlankTitles() {
        assertTrue(Todo.addTask(List.of(), "   ", "1").isEmpty());
    }

    @Test
    void addTaskDoesNotChangeTheOriginalList() {
        List<Task> original = List.of(new Task("1", "A", false));
        Todo.addTask(original, "B", "2");
        assertEquals(1, original.size());
    }

    @Test
    void toggleTaskFlipsTheDoneFlag() {
        List<Task> tasks = Todo.addTask(List.of(), "Estudar", "1");
        List<Task> toggled = Todo.toggleTask(tasks, "1");
        assertTrue(toggled.get(0).done());
        assertFalse(Todo.toggleTask(toggled, "1").get(0).done());
    }

    @Test
    void removeTaskDeletesOnlyTheMatchingTask() {
        List<Task> tasks = Todo.addTask(List.of(), "A", "1");
        tasks = Todo.addTask(tasks, "B", "2");
        List<Task> result = Todo.removeTask(tasks, "1");
        assertEquals(1, result.size());
        assertEquals("B", result.get(0).title());
    }

    @Test
    void countPendingIgnoresDoneTasks() {
        List<Task> tasks = Todo.addTask(List.of(), "A", "1");
        tasks = Todo.addTask(tasks, "B", "2");
        tasks = Todo.toggleTask(tasks, "1");
        assertEquals(1, Todo.countPending(tasks));
    }

    @Test
    void pendingLabelUsesSingularAndPlural() {
        assertEquals("tarefa pendente", Todo.pendingLabel(1));
        assertEquals("tarefas pendentes", Todo.pendingLabel(0));
        assertEquals("tarefas pendentes", Todo.pendingLabel(3));
    }
}
