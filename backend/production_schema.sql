-- Production Schema V1.0
-- Goal Manifest Application

-- Clean slate
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS goal_activity_logs CASCADE;
DROP TABLE IF EXISTS goal_milestones CASCADE;
DROP TABLE IF EXISTS user_checkins CASCADE;
DROP TABLE IF EXISTS goal_calendar CASCADE;
DROP TABLE IF EXISTS goal_tasks CASCADE;
DROP TABLE IF EXISTS roadmap_steps CASCADE;
DROP TABLE IF EXISTS roadmaps CASCADE;
DROP TABLE IF EXISTS goal_sessions CASCADE;
DROP TABLE IF EXISTS goals CASCADE;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar TEXT,
    timezone VARCHAR(100) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_checkins INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Goals
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived', 'onboarding')),
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    target_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    roadmap_generated BOOLEAN DEFAULT FALSE,
    goal_setup_finished BOOLEAN DEFAULT FALSE,
    visibility VARCHAR(50) DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    progress_percent FLOAT DEFAULT 0.0,
    is_archived BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 2.5 Goal Sessions (for Chat History)
CREATE TABLE IF NOT EXISTS goal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    messages JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Roadmaps
CREATE TABLE IF NOT EXISTS roadmaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    generated_by_ai BOOLEAN DEFAULT TRUE,
    duration_days INTEGER,
    roadmap_version INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    locked BOOLEAN DEFAULT FALSE
);

-- 4. RoadmapSteps
CREATE TABLE IF NOT EXISTS roadmap_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roadmap_id UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    estimated_days INTEGER DEFAULT 1,
    dependencies JSONB DEFAULT '[]'::jsonb,
    milestone BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. GoalTasks
CREATE TABLE IF NOT EXISTS goal_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    roadmap_step_id UUID REFERENCES roadmap_steps(id) ON DELETE SET NULL,
    task_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'partial', 'skipped')),
    completion_percent FLOAT DEFAULT 0.0,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. GoalCalendar
CREATE TABLE IF NOT EXISTS goal_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    task_id UUID REFERENCES goal_tasks(id) ON DELETE CASCADE,
    mood VARCHAR(100),
    reflection TEXT,
    evidence_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. UserCheckins
CREATE TABLE IF NOT EXISTS user_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    streak_count INTEGER DEFAULT 1,
    opened_app BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. GoalMilestones
CREATE TABLE IF NOT EXISTS goal_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    achieved_at TIMESTAMP WITH TIME ZONE,
    reward_badge VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. GoalActivityLogs (Audit Logs)
CREATE TABLE IF NOT EXISTS goal_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100),
    title VARCHAR(255),
    message TEXT,
    read_status BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_goal_id ON roadmaps(goal_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_steps_roadmap_id ON roadmap_steps(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_goal_tasks_goal_id ON goal_tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_tasks_date ON goal_tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_user_checkins_user_id_date ON user_checkins(user_id, date);
CREATE INDEX IF NOT EXISTS idx_goal_activity_logs_goal_id ON goal_activity_logs(goal_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
