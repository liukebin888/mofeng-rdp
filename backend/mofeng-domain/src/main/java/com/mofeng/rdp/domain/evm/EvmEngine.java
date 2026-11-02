package com.mofeng.rdp.domain.evm;

import java.util.ArrayList;
import java.util.List;

/**
 * 挣值与成本引擎（SRS 11.8 / CST-003/004、PMC-006/007）。
 * 四值：PV(BCWS) / EV(BCWP) / AC(ACWP) / BAC。
 *
 * 迁移自 app/src/domain/evm.ts，同一套测试用例验收。
 */
public final class EvmEngine {

    private EvmEngine() {
    }

    private static double r2(double n) {
        return Math.round(n * 100) / 100.0;
    }

    public static final class EvmResult {
        public final double pv;
        public final double ev;
        public final double ac;
        public final double bac;
        public final double sv;
        public final double cv;
        public final double spi;
        public final double cpi;
        public final double etc;
        public final double eac;
        public final double vac;
        public final double tcpi;
        public final String spiZone;
        public final String cpiZone;
        public final String eacWarn;

        EvmResult(double pv, double ev, double ac, double bac, double sv, double cv,
                  double spi, double cpi, double etc, double eac, double vac, double tcpi,
                  String spiZone, String cpiZone, String eacWarn) {
            this.pv = pv;
            this.ev = ev;
            this.ac = ac;
            this.bac = bac;
            this.sv = sv;
            this.cv = cv;
            this.spi = spi;
            this.cpi = cpi;
            this.etc = etc;
            this.eac = eac;
            this.vac = vac;
            this.tcpi = tcpi;
            this.spiZone = spiZone;
            this.cpiZone = cpiZone;
            this.eacWarn = eacWarn;
        }
    }

    /** etc 可为 null（表示由 CPI 推算）。 */
    public static EvmResult computeEvm(double pv, double ev, double ac, double bac, Double etcInput) {
        double spi = pv != 0 ? ev / pv : 0;
        double cpi = ac != 0 ? ev / ac : 0;
        double etc = etcInput != null ? etcInput : (cpi != 0 ? (bac - ev) / cpi : bac - ev);
        double eac = ac + etc;
        double vac = bac - eac;
        double tcpi = (bac - ac) != 0 ? (bac - ev) / (bac - ac) : 0;
        String spiZone = spi < 0.8 ? "red" : (spi < 0.9 ? "yellow" : "green");
        String cpiZone = cpi < 0.9 ? "red" : (cpi < 0.95 ? "yellow" : "green");
        double over = bac != 0 ? (eac - bac) / bac : 0;
        String eacWarn = over > 0.1 ? "red" : (over > 0.05 ? "yellow" : "none");
        return new EvmResult(
            r2(pv), r2(ev), r2(ac), r2(bac),
            r2(ev - pv), r2(ev - ac),
            r2(spi), r2(cpi), r2(etc), r2(eac), r2(vac), r2(tcpi),
            spiZone, cpiZone, eacWarn);
    }

    // ------------------------------------------------------------------
    // C-10 成本科目预算校验
    // ------------------------------------------------------------------

    public static final class BudgetLine {
        public final String subject;
        public final double budget;
        public final String wbsCode; // 可为 null

        public BudgetLine(String subject, double budget, String wbsCode) {
            this.subject = subject;
            this.budget = budget;
            this.wbsCode = wbsCode;
        }
    }

    public static final class BudgetResult {
        public final boolean ok;
        public final List<String> missingSubject;
        public final double total;

        BudgetResult(boolean ok, List<String> missingSubject, double total) {
            this.ok = ok;
            this.missingSubject = missingSubject;
            this.total = total;
        }
    }

    /** 无预算不得开工（C-10）。 */
    public static BudgetResult budgetCheck(List<BudgetLine> budgetLines) {
        List<String> missing = new ArrayList<>();
        double total = 0;
        for (BudgetLine b : budgetLines) {
            if (b.wbsCode == null || b.wbsCode.isEmpty()) missing.add(b.subject);
            total += b.budget;
        }
        return new BudgetResult(missing.isEmpty() && total > 0, missing, total);
    }

    // ------------------------------------------------------------------
    // C-12 超支审批
    // ------------------------------------------------------------------

    public static final class OverspendResult {
        public final double ratio;
        public final boolean needApproval;
        public final String level;

        OverspendResult(double ratio, boolean needApproval, String level) {
            this.ratio = ratio;
            this.needApproval = needApproval;
            this.level = level;
        }
    }

    /** 超预算 >10% 须专项审批（C-12）。 */
    public static OverspendResult overspend(double budget, double spent) {
        double ratio = budget != 0 ? spent / budget : 0;
        double ratioRounded = Math.round(ratio * 10000) / 100.0;
        return new OverspendResult(ratioRounded, ratio > 1.1, ratio > 1.1 ? "L3" : "ok");
    }
}
