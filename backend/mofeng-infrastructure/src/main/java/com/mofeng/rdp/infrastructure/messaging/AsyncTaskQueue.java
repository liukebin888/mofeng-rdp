package com.mofeng.rdp.infrastructure.messaging;

import com.mofeng.rdp.domain.task.AsyncTaskEngine.Task;

/**
 * 异步任务队列抽象（基础设施层，B4 报表生成/批量导入/AI 调用）。
 *
 * <p>只做队列投递/消费编排，任务判定（提交校验/幂等/状态机）复用领域层 {@code AsyncTaskEngine}。
 * 至少一次投递 + 消费端幂等，租户上下文显式随任务传递（TEN-004）。</p>
 */
public interface AsyncTaskQueue {

    /** 提交异步任务（至少一次投递）。 */
    void submit(Task task);

    /** 消费异步任务。 */
    void consume(TaskHandler handler);

    /** 任务处理器。 */
    @FunctionalInterface
    interface TaskHandler {
        void onTask(Task task);
    }
}
