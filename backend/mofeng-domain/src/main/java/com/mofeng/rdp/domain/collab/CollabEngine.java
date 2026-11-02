package com.mofeng.rdp.domain.collab;

import java.util.ArrayList;
import java.util.List;

/**
 * 协同沟通引擎（SRS 第 12 章 · COM-001~009 / FUN-024 项目门户与协同沟通）。
 *
 * <p>与前端 TS 引擎 {@code app/src/domain/collabEngine.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>解决「项目门户的会议、送审件、督办全是视图内硬编码假数据」：</p>
 * <ul>
 *   <li>会议决议条目化（COM-006）：决议必为条目结构，缺责任人或期限不可保存。</li>
 *   <li>决议转任务（COM-007）：同一决议不重复建任务，状态双向同步。</li>
 *   <li>决议逾期升级与关闭判定（COM-008）：逾期自动升级；无证据关闭被拒。</li>
 *   <li>送审件登记与流转（COM-001）：必带版本；全程留痕；无结论不得关闭。</li>
 *   <li>送审件超时升级（COM-002）：答复超期自动升级。</li>
 *   <li>督办四态闭环（COM-009）：交办→反馈→复核→销项，四动作均留痕，超期自动升级。</li>
 * </ul>
 *
 * <p>纯函数、领域层纯对象，禁止依赖框架（ARC-001）。日期字符串按 YYYY-MM-DD 字典序比较，
 * 「今天」由调用方注入保证可测。</p>
 */
public final class CollabEngine {

    private CollabEngine() {
    }

    /** 决议条目（COM-006）。 */
    public static final class ResolutionItem {
        public final String id;
        public final String projectId;
        public final String meetingId;
        public final String code;
        public final String content;
        public final String owner;
        public final String due;
        public final String status; // 待执行/执行中/已闭环
        public final String taskId; // 可为 null
        public final String evidence; // 可为 null
        public final String createdAt;

        public ResolutionItem(String id, String projectId, String meetingId, String code, String content,
                              String owner, String due, String status, String taskId, String evidence, String createdAt) {
            this.id = id;
            this.projectId = projectId;
            this.meetingId = meetingId;
            this.code = code;
            this.content = content;
            this.owner = owner;
            this.due = due;
            this.status = status;
            this.taskId = taskId;
            this.evidence = evidence;
            this.createdAt = createdAt;
        }
    }

    /** 会议（COM-005 策划四要素 + COM-006 记录 + COM-012 与 Gate 关联）。 */
    public static final class MeetingItem {
        public final String id;
        public final String projectId;
        public final String code;
        public final String title;
        public final String date;
        public final String stage; // 可为 null
        public final String gateId; // 可为 null
        public final String host;
        public final List<String> attendees;
        public final String agenda;
        public final String minutes;
        public final List<String> resolutions;
        public final String status; // 策划中/已召开/已归档

        public MeetingItem(String id, String projectId, String code, String title, String date, String stage,
                           String gateId, String host, List<String> attendees, String agenda, String minutes,
                           List<String> resolutions, String status) {
            this.id = id;
            this.projectId = projectId;
            this.code = code;
            this.title = title;
            this.date = date;
            this.stage = stage;
            this.gateId = gateId;
            this.host = host;
            this.attendees = attendees == null ? new ArrayList<>() : attendees;
            this.agenda = agenda;
            this.minutes = minutes;
            this.resolutions = resolutions == null ? new ArrayList<>() : resolutions;
            this.status = status;
        }
    }

    /** 送审件答复记录。 */
    public static final class SendAuditAnswer {
        public final String at;
        public final String by;
        public final String content;

        public SendAuditAnswer(String at, String by, String content) {
            this.at = at;
            this.by = by;
            this.content = content;
        }
    }

    /** 送审件（COM-001 登记与流转 + COM-002 超时升级）。 */
    public static final class SendAuditItem {
        public final String id;
        public final String projectId;
        public final String code;
        public final String title;
        public final String version;
        public final String reviewerType; // 客户/内部/供应商
        public final String reviewer;
        public final String sentAt;
        public final String dueAt;
        public final String status; // 待答复/已答复/已超期
        public final List<SendAuditAnswer> answers;
        public final boolean escalated;

        public SendAuditItem(String id, String projectId, String code, String title, String version,
                             String reviewerType, String reviewer, String sentAt, String dueAt, String status,
                             List<SendAuditAnswer> answers, boolean escalated) {
            this.id = id;
            this.projectId = projectId;
            this.code = code;
            this.title = title;
            this.version = version;
            this.reviewerType = reviewerType;
            this.reviewer = reviewer;
            this.sentAt = sentAt;
            this.dueAt = dueAt;
            this.status = status;
            this.answers = answers == null ? new ArrayList<>() : answers;
            this.escalated = escalated;
        }
    }

    /** 督办动作记录。 */
    public static final class SuperviseAction {
        public final String at;
        public final String by;
        public final String action; // 交办/反馈/复核/销项
        public final String note;

        public SuperviseAction(String at, String by, String action, String note) {
            this.at = at;
            this.by = by;
            this.action = action;
            this.note = note;
        }
    }

    /** 督办事项（COM-009：交办→反馈→复核→销项 四态闭环，超期自动升级）。 */
    public static final class SuperviseItem {
        public final String id;
        public final String projectId;
        public final String code;
        public final String title;
        public final String owner;
        public final String due;
        public final String status; // 交办/反馈/复核/已销项
        public final List<SuperviseAction> actions;
        public final boolean escalated;

        public SuperviseItem(String id, String projectId, String code, String title, String owner,
                             String due, String status, List<SuperviseAction> actions, boolean escalated) {
            this.id = id;
            this.projectId = projectId;
            this.code = code;
            this.title = title;
            this.owner = owner;
            this.due = due;
            this.status = status;
            this.actions = actions == null ? new ArrayList<>() : actions;
            this.escalated = escalated;
        }
    }

    // —— 日期工具（逾期判定）——

    /** 是否逾期：due 早于 today（字符串 YYYY-MM-DD 直接字典序比较）。 */
    public static boolean isOverdue(String due, String today) {
        return due.compareTo(today) < 0;
    }

    // —— 会议决议条目化（COM-006）——

    /** 决议保存校验：内容 + 责任人 + 期限三要素必填（COM-006）。 */
    public static List<String> validateResolution(String content, String owner, String due) {
        List<String> errors = new ArrayList<>();
        if (content == null || content.trim().isEmpty()) {
            errors.add("决议内容不能为空");
        }
        if (owner == null || owner.trim().isEmpty()) {
            errors.add("责任人不能为空");
        }
        if (due == null || due.trim().isEmpty()) {
            errors.add("期限不能为空");
        }
        return errors;
    }

    /** 生成决议条目编码（同一项目内递增，全局不复用）。 */
    public static String nextResolutionCode(List<ResolutionItem> resolutions, String projectId) {
        int mine = 0;
        for (ResolutionItem r : resolutions) {
            if (r.projectId.equals(projectId)) {
                mine++;
            }
        }
        return String.format("RES-%03d", mine + 1);
    }

    /** 决议转任务：同一决议不重复建任务（COM-007）。 */
    public static ResolutionItem resolutionToTask(ResolutionItem resolution, String taskId) {
        if (resolution.taskId != null) {
            return resolution; // 幂等
        }
        String status = "待执行".equals(resolution.status) ? "执行中" : resolution.status;
        return new ResolutionItem(resolution.id, resolution.projectId, resolution.meetingId, resolution.code,
                resolution.content, resolution.owner, resolution.due, status, taskId, resolution.evidence,
                resolution.createdAt);
    }

    /** 决议关闭判定：无证据关闭被拒（COM-008）。 */
    public static CloseResult closeResolution(ResolutionItem resolution, String evidence, String today) {
        if (evidence == null || evidence.trim().isEmpty()) {
            return new CloseResult(resolution, false, List.of("无证据关闭被拒（COM-008）"));
        }
        ResolutionItem closed = new ResolutionItem(resolution.id, resolution.projectId, resolution.meetingId,
                resolution.code, resolution.content, resolution.owner, resolution.due, "已闭环",
                resolution.taskId, evidence.trim(), resolution.createdAt);
        return new CloseResult(closed, true, List.of());
    }

    /** 决议逾期判定 + 升级标记（COM-008）。 */
    public static List<ResolutionItem> overdueResolutions(List<ResolutionItem> resolutions, String today) {
        List<ResolutionItem> out = new ArrayList<>();
        for (ResolutionItem r : resolutions) {
            if (!"已闭环".equals(r.status) && isOverdue(r.due, today)) {
                out.add(r);
            }
        }
        return out;
    }

    // —— 会议（COM-005 / COM-006 / COM-012）——

    /** 会议策划四要素校验（COM-005）。 */
    public static List<String> validateMeeting(String title, String agenda, String host, String date, List<String> attendees) {
        List<String> errors = new ArrayList<>();
        if (title == null || title.trim().isEmpty()) {
            errors.add("会议标题不能为空");
        }
        if (agenda == null || agenda.trim().isEmpty()) {
            errors.add("议题不能为空");
        }
        if (host == null || host.trim().isEmpty()) {
            errors.add("主持人不能为空");
        }
        if (date == null || date.trim().isEmpty()) {
            errors.add("日期不能为空");
        }
        if (attendees == null || attendees.isEmpty()) {
            errors.add("参会人不能为空");
        }
        return errors;
    }

    /** 会议与 Gate 关联校验：关联后结论单向写入（COM-012）。 */
    public static MeetingItem linkGate(MeetingItem meeting, String gateId) {
        return new MeetingItem(meeting.id, meeting.projectId, meeting.code, meeting.title, meeting.date,
                meeting.stage, gateId, meeting.host, meeting.attendees, meeting.agenda, meeting.minutes,
                meeting.resolutions, meeting.status);
    }

    // —— 送审件（COM-001 流转 / COM-002 超时升级）——

    /** 送审件登记校验：必带版本与期限（COM-001）。 */
    public static List<String> validateSendAudit(String title, String version, String reviewerType,
                                                 String reviewer, String dueAt) {
        List<String> errors = new ArrayList<>();
        if (title == null || title.trim().isEmpty()) {
            errors.add("送审件标题不能为空");
        }
        if (version == null || version.trim().isEmpty()) {
            errors.add("版本不能为空（COM-001）");
        }
        if (reviewer == null || reviewer.trim().isEmpty()) {
            errors.add("送审对象不能为空");
        }
        if (dueAt == null || dueAt.trim().isEmpty()) {
            errors.add("答复期限不能为空（COM-001）");
        }
        return errors;
    }

    /** 送审件答复：全程留痕（往返记录）；无答复不得关闭（COM-001）。 */
    public static AnswerResult answerSendAudit(SendAuditItem item, String by, String content, String at, String today) {
        if (content == null || content.trim().isEmpty()) {
            return new AnswerResult(item, List.of("答复内容不能为空"));
        }
        List<SendAuditAnswer> answers = new ArrayList<>(item.answers);
        answers.add(new SendAuditAnswer(at, by, content.trim()));
        boolean escalated = item.escalated || isOverdue(item.dueAt, today);
        SendAuditItem out = new SendAuditItem(item.id, item.projectId, item.code, item.title, item.version,
                item.reviewerType, item.reviewer, item.sentAt, item.dueAt, "已答复", answers, escalated);
        return new AnswerResult(out, List.of());
    }

    /** 送审件超时升级：答复期已过且未答复 → 升级（COM-002）。 */
    public static SendAuditItem escalateSendAudit(SendAuditItem item, String today) {
        if ("待答复".equals(item.status) && isOverdue(item.dueAt, today)) {
            return new SendAuditItem(item.id, item.projectId, item.code, item.title, item.version,
                    item.reviewerType, item.reviewer, item.sentAt, item.dueAt, "已超期", item.answers, true);
        }
        return item;
    }

    // —— 督办四态闭环（COM-009）——

    /** 督办推进结果。 */
    public static final class AdvanceResult {
        public final SuperviseItem item;
        public final boolean advanced;
        public final List<String> errors;

        AdvanceResult(SuperviseItem item, boolean advanced, List<String> errors) {
            this.item = item;
            this.advanced = advanced;
            this.errors = errors;
        }
    }

    /** 决议关闭结果。 */
    public static final class CloseResult {
        public final ResolutionItem resolution;
        public final boolean closed;
        public final List<String> errors;

        CloseResult(ResolutionItem resolution, boolean closed, List<String> errors) {
            this.resolution = resolution;
            this.closed = closed;
            this.errors = errors;
        }
    }

    /** 送审答复结果。 */
    public static final class AnswerResult {
        public final SendAuditItem item;
        public final List<String> errors;

        AnswerResult(SendAuditItem item, List<String> errors) {
            this.item = item;
            this.errors = errors;
        }
    }

    private static String nextStatus(String status) {
        switch (status) {
            case "交办":
                return "反馈";
            case "反馈":
                return "复核";
            case "复核":
                return "已销项";
            default:
                return null;
        }
    }

    private static String actionForStatus(String status) {
        switch (status) {
            case "交办":
                return "反馈";
            case "反馈":
                return "复核";
            case "复核":
                return "销项";
            default:
                return "销项";
        }
    }

    /** 督办推进：按状态机流转，动作留痕；超期自动升级。 */
    public static AdvanceResult advanceSupervise(SuperviseItem item, String action, String by, String note,
                                                 String at, String today) {
        String expected = nextStatus(item.status);
        if (expected == null) {
            return new AdvanceResult(item, false, List.of("已销项事项不可再推进"));
        }
        String required = actionForStatus(item.status);
        if (!required.equals(action)) {
            return new AdvanceResult(item, false, List.of("当前「" + item.status + "」态只能执行「" + required + "」"));
        }
        List<SuperviseAction> actions = new ArrayList<>(item.actions);
        actions.add(new SuperviseAction(at, by, action, note));
        boolean escalated = item.escalated || isOverdue(item.due, today);
        SuperviseItem out = new SuperviseItem(item.id, item.projectId, item.code, item.title, item.owner,
                item.due, expected, actions, escalated);
        return new AdvanceResult(out, true, List.of());
    }

    /** 督办超期升级：未销项且已逾期 → 标记升级（COM-009）。 */
    public static SuperviseItem escalateSupervise(SuperviseItem item, String today) {
        if (!"已销项".equals(item.status) && isOverdue(item.due, today)) {
            return new SuperviseItem(item.id, item.projectId, item.code, item.title, item.owner, item.due,
                    item.status, item.actions, true);
        }
        return item;
    }
}
