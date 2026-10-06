import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import membersRouter from "./members";
import uploadRouter from "./upload";
import financeRouter from "./finance";
import financeSalesRouter from "./finance-sales";
import financeTeamRouter from "./finance-team";
import dashboardRouter from "./dashboard";
import goalsRouter from "./goals";
import workspaceRouter from "./workspace";
import meetingsRouter from "./meetings";
import whatsappRouter from "./whatsapp";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/projects", projectsRouter);
router.use("/tasks", tasksRouter);
router.use("/members", membersRouter);
router.use("/upload", uploadRouter);
router.use("/finance", financeRouter);
router.use("/finance", financeSalesRouter);
router.use("/finance", financeTeamRouter);
router.use("/dashboard", dashboardRouter);
router.use("/goals", goalsRouter);
router.use("/workspace", workspaceRouter);
router.use("/meetings", meetingsRouter);
router.use("/whatsapp", whatsappRouter);

export default router;
