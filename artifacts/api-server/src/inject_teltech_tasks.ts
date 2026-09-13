import { db, usersTable, workspacesTable, projectsTable, columnsTable, tasksTable, tagsTable, taskTagsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

async function run() {
  console.log("Injecting Teltech tasks...");
  
  // 1. Get workspace "Teltech"
  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.name, "Teltech")).limit(1);
  if (!ws) {
    console.log("Teltech workspace not found.");
    process.exit(1);
  }

  // 2. Get user to assign as owner
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, "tarcisio@teltech.com.br")).limit(1);
  if (!user) {
    console.log("User tarcisio not found.");
    process.exit(1);
  }

  // 3. Create or get "Teltech" project
  let [project] = await db.select().from(projectsTable).where(eq(projectsTable.name, "Teltech")).limit(1);
  if (!project) {
    [project] = await db.insert(projectsTable).values({
      workspaceId: ws.id,
      name: "Teltech",
      color: "#4f2d8a",
      createdBy: user.id
    }).returning();
    console.log("Created project Teltech");
  } else {
    console.log("Project Teltech already exists. Clearing columns...");
    await db.delete(columnsTable).where(eq(columnsTable.projectId, project.id));
  }

  // 4. Create columns
  const colsData = [
    { title: "Sem Título", pos: 0 },
    { title: "A Fazer", pos: 1 },
    { title: "Em Andamento", pos: 2 },
    { title: "Revisão", pos: 3 },
    { title: "Concluído", pos: 4 }
  ];

  const cols = [];
  for (const c of colsData) {
    const [col] = await db.insert(columnsTable).values({
      projectId: project.id,
      title: c.title,
      position: c.pos
    }).returning();
    cols.push(col);
  }

  // 5. Create tags
  const tagsToCreate = [
    { label: "QA", color: "blue" as const },
    { label: "UX/UI", color: "purple" as const },
    { label: "Sem cobrança", color: "gray" as const },
    { label: "Gestão", color: "pink" as const },
    { label: "Marketing", color: "yellow" as const }
  ];
  
  for (const t of tagsToCreate) {
    const existing = await db.select().from(tagsTable).where(and(eq(tagsTable.projectId, project.id), eq(tagsTable.label, t.label))).limit(1);
    if (existing.length === 0) {
      await db.insert(tagsTable).values({ projectId: project.id, label: t.label, color: t.color });
    }
  }

  const allTags = await db.select().from(tagsTable).where(eq(tagsTable.projectId, project.id));
  const tagMap = new Map(allTags.map(t => [t.label, t.id]));

  // 6. Create tasks
  const TASKS_MOCK = [
    { colIdx: 0, title: "Testes (Páginas da Plataforma)", est: 0, tags: ["QA"] },
    { colIdx: 0, title: "StrataScratch - Apresentação Dribbble (Versão #4)", est: 8, tags: ["UX/UI", "Sem cobrança"] },
    { colIdx: 0, title: "Coletar feedback de clientes do Clutch", est: 0, tags: [] },
    { colIdx: 0, title: "Retrospectiva do projeto", est: 2, tags: ["Gestão"] },
    
    { colIdx: 1, title: "StrataScratch - Post para Instagram", est: 1, tags: ["UX/UI", "Marketing", "Sem cobrança"] },
    { colIdx: 1, title: "StrataScratch - Nova Página de Preços", est: 3, tags: ["UX/UI"] },
    { colIdx: 1, title: "StrataScratch - Anúncios Display (#3)", est: 8, tags: ["UX/UI", "Marketing"] },
    
    { colIdx: 2, title: "StrataScratch - Apresentação Behance", est: 30, tags: ["UX/UI", "Sem cobrança"] },
    { colIdx: 2, title: "StrataScratch - Anúncios Display (#2)", est: 4, tags: ["UX/UI", "Marketing"] },
    { colIdx: 2, title: "Strata Scratch - Animação para tela de carregamento", est: 1, tags: ["UX/UI"] },
    
    { colIdx: 3, title: "StrataScratch - Anúncios Display", est: 8, tags: ["UX/UI", "Marketing"] },
    { colIdx: 3, title: "StrataScratch - Apresentação Dribbble (Versão #3)", est: 3, tags: ["UX/UI", "Sem cobrança"] },
    
    { colIdx: 4, title: "Nova página inicial do site", est: 8, tags: ["UX/UI"] },
    { colIdx: 4, title: "Corrigir e testar no Zeplin", est: 3, tags: ["QA"] },
    { colIdx: 4, title: "Corrigir bug no mobile", est: 2, tags: ["QA"] },
  ];

  let posCounter = 0;
  let lastColIdx = 0;

  for (const tm of TASKS_MOCK) {
    if (tm.colIdx !== lastColIdx) {
      posCounter = 0;
      lastColIdx = tm.colIdx;
    }

    const col = cols[tm.colIdx];
    const [task] = await db.insert(tasksTable).values({
      projectId: project.id,
      columnId: col.id,
      title: tm.title,
      position: posCounter++,
      estimatedHours: tm.est > 0 ? tm.est : null,
      createdBy: user.id
    }).returning();

    for (const tl of tm.tags) {
      const tagId = tagMap.get(tl);
      if (tagId) {
        await db.insert(taskTagsTable).values({ taskId: task.id, tagId });
      }
    }
  }

  console.log("Done injecting tasks!");
  process.exit(0);
}

run().catch(console.error);
