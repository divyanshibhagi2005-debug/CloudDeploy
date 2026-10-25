
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Code2,
  Cpu,
  ExternalLink,
  GitBranch,
  HardDrive,
  LayoutDashboard,
  ListTodo,
  Menu,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  X,
  Clock,
  AlertCircle,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const API = ''

type Task = {
  id: number
  title: string
  completed: boolean
}

type Page = 'Overview' | 'Task Manager' | 'Infrastructure' | 'Deployments'

type CloudWatchAlarm = {
  name: string
  state: string
  reason: string
}

type CloudWatchMetrics = {
  status: 'success' | 'error'
  region: string
  timestamp: string
  cpu_percent: number | null
  memory_percent: number | null
  disk_percent: number | null
  alarms: CloudWatchAlarm[]
}

type ChartPoint = {
  time: string
  cpu: number | null
  memory: number | null
}

type WorkflowRun = {
  id: number
  name: string
  status: string | null
  conclusion: string | null
  branch: string | null
  commit: string
  html_url: string
  created_at: string
  updated_at: string
  run_number: number
}

type WorkflowResponse = {
  status: 'success' | 'error'
  total_count: number
  workflow_runs: WorkflowRun[]
  message?: string
}

const initialTasks: Task[] = [
  { id: 1, title: 'Learn Docker', completed: false },
  { id: 2, title: 'Deploy on AWS', completed: false },
]

const activity = [
  {
    title: 'CloudWatch monitoring configured',
    detail: 'EC2 · CloudDeploy/EC2',
    time: 'Monitoring',
  },
  {
    title: 'Container deployment pipeline ready',
    detail: 'GitHub Actions · master',
    time: 'CI/CD',
  },
  {
    title: 'Infrastructure managed with Terraform',
    detail: 'AWS · us-east-1',
    time: 'Infrastructure',
  },
]

function App() {
  const [page, setPage] = useState<Page>('Overview')
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [newTask, setNewTask] = useState('')
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [taskError, setTaskError] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [notice, setNotice] = useState('')
  const [cloudMetrics, setCloudMetrics] = useState<CloudWatchMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState('')
  const [chartData, setChartData] = useState<ChartPoint[]>([])

  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([])
  const [workflowTotal, setWorkflowTotal] = useState(0)
  const [workflowsLoading, setWorkflowsLoading] = useState(false)
  const [workflowsError, setWorkflowsError] = useState('')
  const [lastWorkflowUpdate, setLastWorkflowUpdate] = useState<string | null>(null)

  async function loadCloudMetrics() {
    setMetricsLoading(true)
    setMetricsError('')

    try {
      const response = await fetch(`${API}/cloudwatch/metrics`, {
        cache: 'no-store',
      })

      if (!response.ok) throw new Error('CloudWatch request failed')

      const data: CloudWatchMetrics = await response.json()

      if (data.status !== 'success') {
        throw new Error('CloudWatch returned an error')
      }

      setCloudMetrics(data)

      const point: ChartPoint = {
        time: new Date(data.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        cpu: data.cpu_percent,
        memory: data.memory_percent,
      }

      setChartData((current) => [...current, point].slice(-7))
    } catch {
      setMetricsError(
        'Could not load live CloudWatch metrics. Check the backend endpoint and try refreshing.',
      )
    } finally {
      setMetricsLoading(false)
    }
  }

  async function checkHealth() {
    try {
      const response = await fetch(`${API}/health`)
      if (!response.ok) throw new Error('Health check failed')
      setApiStatus('online')
    } catch {
      setApiStatus('offline')
    }
  }

  async function loadTasks() {
    setLoadingTasks(true)
    setTaskError('')

    try {
      const response = await fetch(`${API}/tasks`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Unable to load tasks')

      const data: Task[] = await response.json()
      setTasks(data)
    } catch {
      setTaskError(
        'Could not connect to the API. Start the Flask backend and try again.',
      )
    } finally {
      setLoadingTasks(false)
    }
  }

  async function loadWorkflows() {
    setWorkflowsLoading(true)
    setWorkflowsError('')

    try {
      const response = await fetch(`${API}/github/workflows`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('GitHub token is not configured on the backend.')
        }
        if (response.status === 502) {
          throw new Error('GitHub could not be reached. Check the backend logs.')
        }
        throw new Error(`Unable to load workflow history (${response.status}).`)
      }

      const data: WorkflowResponse = await response.json()

      if (data.status !== 'success') {
        throw new Error(data.message || 'GitHub returned an error.')
      }

      setWorkflowRuns(data.workflow_runs ?? [])
      setWorkflowTotal(data.total_count ?? 0)
      setLastWorkflowUpdate(new Date().toISOString())
    } catch (error) {
      setWorkflowsError(
        error instanceof Error
          ? error.message
          : 'Could not load GitHub Actions history.',
      )
    } finally {
      setWorkflowsLoading(false)
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const title = newTask.trim()
    if (!title) return

    setTaskError('')

    try {
      const response = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })

      if (!response.ok) throw new Error('Could not create task')

      const task: Task = await response.json()
      setTasks((current) => [...current, task])
      setNewTask('')
      setNotice('Task added successfully')
      window.setTimeout(() => setNotice(''), 2500)
    } catch {
      setTaskError('Could not add task. Check that the Flask API is running.')
    }
  }

  async function refreshCurrentPage() {
    void checkHealth()

    if (page === 'Overview' || page === 'Task Manager') {
      void loadTasks()
    }

    if (page === 'Overview' || page === 'Infrastructure') {
      void loadCloudMetrics()
    }

    if (page === 'Deployments') {
      void loadWorkflows()
    }
  }

  useEffect(() => {
    void checkHealth()
    void loadTasks()
    void loadCloudMetrics()

    const intervalId = window.setInterval(() => {
      void checkHealth()
      void loadCloudMetrics()
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (page === 'Deployments') {
      void loadWorkflows()
    }
  }, [page])

  const navItems: { label: Page; icon: typeof LayoutDashboard }[] = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Task Manager', icon: ListTodo },
    { label: 'Infrastructure', icon: Activity },
    { label: 'Deployments', icon: GitBranch },
  ]

  const completed = tasks.filter((task) => task.completed).length

  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          className="mobile-overlay"
          onClick={() => setMobileMenu(false)}
          aria-label="Close menu"
        />
      )}

      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon"><Cloud size={23} /></div>
          <div>
            <div className="brand-name">clouddeploy</div>
            <div className="brand-caption">CLOUD OPERATIONS</div>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <div className="workspace">
          <div className="workspace-avatar">C</div>
          <div className="workspace-copy">
            <strong>CloudDeploy</strong>
            <span>Personal environment</span>
          </div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-heading">PLATFORM</div>

        <nav className="nav-list">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${page === label ? 'nav-active' : ''}`}
              onClick={() => {
                setPage(label)
                setMobileMenu(false)
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'Task Manager' && (
                <span className="nav-count">{tasks.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="region-card">
            <div className="region-icon"><Cloud size={17} /></div>
            <div>
              <span>Cloud region</span>
              <strong>US East (N. Virginia)</strong>
            </div>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">DB</div>
            <div className="user-copy">
              <strong>CloudDeploy Admin</strong>
              <span>Project workspace</span>
            </div>
            <span className="user-dot" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button menu-toggle"
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{page}</strong>
          </div>

          <div className="topbar-actions">
            <div className="environment-pill"><span /> AWS ENVIRONMENT</div>
            <button className="icon-button notification-button" aria-label="Notifications">
              <Bell size={19} />
              <i />
            </button>
            <div className="top-avatar">DB</div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">CLOUDDEPLOY / WORKSPACE</div>
              <h1>{page === 'Overview' ? 'Good to see you.' : page}</h1>
              <p>
                {page === 'Overview' && 'Your cloud environment, at a glance.'}
                {page === 'Task Manager' && 'Keep track of work across your cloud project.'}
                {page === 'Infrastructure' && 'A closer look at your cloud environment.'}
                {page === 'Deployments' && 'Your application delivery workflow.'}
              </p>
            </div>

            <button className="refresh-button" onClick={() => void refreshCurrentPage()}>
              <RefreshCw size={15} /> Refresh data
            </button>
          </div>

          {page === 'Overview' && (
            <>
              <section className="welcome-banner">
                <div className="welcome-copy">
                  <div className="welcome-tag"><span /> YOUR CLOUD WORKSPACE</div>
                  <h2>Infrastructure that<br />works in harmony.</h2>
                  <p>
                    Application deployment, infrastructure management and
                    monitoring in one place.
                  </p>
                  <button
                    onClick={() => setPage('Infrastructure')}
                    className="banner-link"
                  >
                    Explore infrastructure <ArrowUpRight size={16} />
                  </button>
                </div>

                <div className="banner-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="orbit orbit-three" />
                  <div className="orbit-core"><Cloud size={34} /></div>
                  <div className="orbit-node node-one"><Server size={17} /></div>
                  <div className="orbit-node node-two"><ShieldCheck size={17} /></div>
                  <div className="orbit-node node-three"><Activity size={17} /></div>
                </div>

                <div className="banner-index">01 — CLOUD OVERVIEW</div>
              </section>

              <div className="section-heading">
                <div>
                  <h2>Environment overview</h2>
                  <p>A live snapshot of your application services.</p>
                </div>
                <span className="updated-label">
                  <span /> {metricsLoading ? 'UPDATING' : 'LIVE METRICS'}
                </span>
              </div>

              <section className="metrics-grid">
                <MetricCard
                  icon={<Activity size={19} />}
                  label="Application health"
                  value={apiStatus === 'checking' ? 'Checking' : apiStatus === 'online' ? 'Healthy' : 'Offline'}
                  detail={apiStatus === 'online' ? 'Flask API responding' : apiStatus === 'offline' ? 'API connection failed' : 'Checking /health'}
                  tone={apiStatus === 'online' ? 'green' : apiStatus === 'offline' ? 'red' : 'neutral'}
                />
                <MetricCard
                  icon={<ListTodo size={19} />}
                  label="Total tasks"
                  value={String(tasks.length).padStart(2, '0')}
                  detail={`${completed} completed · ${tasks.length - completed} remaining`}
                  tone="sage"
                />
                <MetricCard
                  icon={<Cpu size={19} />}
                  label="CPU utilization"
                  value={formatPercent(cloudMetrics?.cpu_percent)}
                  detail="Live CloudWatch metric"
                  tone="blue"
                />
                <MetricCard
                  icon={<ShieldCheck size={19} />}
                  label="High CPU alarm"
                  value={getAlarmState(cloudMetrics)}
                  detail={cloudMetrics?.alarms[0]?.name ?? 'CloudWatch alarm'}
                  tone={getAlarmTone(cloudMetrics)}
                />
              </section>

              {metricsError && <div className="error-message">{metricsError}</div>}

              <section className="content-grid">
                <div className="panel chart-panel">
                  <div className="panel-header">
                    <div>
                      <h3>Resource activity</h3>
                      <p>Live readings collected while the dashboard is open</p>
                    </div>
                    <span className="task-total">Last 7 readings</span>
                  </div>

                  <div className="chart-legend">
                    <span><i className="legend-cpu" /> CPU</span>
                    <span><i className="legend-memory" /> Memory</span>
                  </div>

                  <div className="chart-area">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#416b59" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#416b59" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="memoryFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c7a66a" stopOpacity={0.17} />
                            <stop offset="95%" stopColor="#c7a66a" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#e9e8e1" strokeDasharray="3 5" vertical={false} />
                        <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#8c938a' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#8c938a' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e4dc', fontSize: 12 }} />
                        <Area type="monotone" dataKey="cpu" name="CPU (%)" connectNulls={false} stroke="#416b59" strokeWidth={2} fill="url(#cpuFill)" />
                        <Area type="monotone" dataKey="memory" name="Memory (%)" connectNulls={false} stroke="#c7a66a" strokeWidth={2} fill="url(#memoryFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-note">
                    <span className="note-dot" />
                    {metricsError || (chartData.length
                      ? `Last updated ${cloudMetrics ? new Date(cloudMetrics.timestamp).toLocaleTimeString() : 'recently'} · refreshes every 60 seconds.`
                      : 'Waiting for the first live CloudWatch reading. No sample values are shown.')}
                  </div>
                </div>

                <div className="panel activity-panel">
                  <div className="panel-header">
                    <div>
                      <h3>Project activity</h3>
                      <p>Configured project capabilities</p>
                    </div>
                    <button className="text-action" onClick={() => setPage('Deployments')}>
                      View all <ArrowUpRight size={14} />
                    </button>
                  </div>

                  <div className="activity-list">
                    {activity.map((item, index) => (
                      <div className="activity-item" key={item.title}>
                        <div className={`activity-icon activity-${index}`}>
                          <CheckCircle2 size={17} />
                        </div>
                        <div className="activity-copy">
                          <strong>{item.title}</strong>
                          <span>{item.detail}</span>
                        </div>
                        <span className="activity-time">{item.time}</span>
                      </div>
                    ))}
                  </div>

                  <div className="activity-footer">
                    <div className="footer-check"><CheckCircle2 size={17} /></div>
                    <div>
                      <strong>Deployment foundation ready</strong>
                      <span>CI/CD and infrastructure configured</span>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {page === 'Task Manager' && (
            <section className="panel task-panel">
              <div className="panel-header">
                <div>
                  <h3>Project tasks</h3>
                  <p>Changes are sent to the Flask API.</p>
                </div>
                <span className="task-total">{tasks.length} tasks</span>
              </div>

              <form className="task-form" onSubmit={addTask}>
                <input
                  value={newTask}
                  onChange={(event) => setNewTask(event.target.value)}
                  placeholder="What needs to be done?"
                  aria-label="New task title"
                />
                <button type="submit" disabled={!newTask.trim()}>
                  <Plus size={17} /> Add task
                </button>
              </form>

              {taskError && <div className="error-message">{taskError}</div>}
              {notice && <div className="success-message">{notice}</div>}

              {loadingTasks ? (
                <p className="empty-state">Loading tasks…</p>
              ) : (
                <div className="task-list">
                  {tasks.map((task) => (
                    <div className="task-row" key={task.id}>
                      <div className={`task-check ${task.completed ? 'task-done' : ''}`}>
                        {task.completed && <CheckCircle2 size={17} />}
                      </div>
                      <span className={task.completed ? 'task-title-done' : ''}>{task.title}</span>
                      <span className={`task-status ${task.completed ? 'status-done' : ''}`}>
                        {task.completed ? 'Completed' : 'In progress'}
                      </span>
                    </div>
                  ))}
                  {tasks.length === 0 && <p className="empty-state">No tasks yet. Add your first task above.</p>}
                </div>
              )}

              <button className="secondary-button" onClick={() => void loadTasks()}>
                <RefreshCw size={15} /> Reload from API
              </button>
            </section>
          )}

          {page === 'Infrastructure' && (
            <>
              <div className="infrastructure-callout">
                <div className="callout-icon"><Cloud size={22} /></div>
                <div>
                  <strong>AWS infrastructure</strong>
                  <p>
                    Live metrics are retrieved from CloudWatch in us-east-1.{' '}
                    {metricsError || (cloudMetrics
                      ? `Last API reading: ${new Date(cloudMetrics.timestamp).toLocaleString()}.`
                      : 'Waiting for the first CloudWatch response.')}
                  </p>
                </div>
              </div>

              <section className="metrics-grid infra-metrics">
                <MetricCard icon={<Cpu size={19} />} label="CPU utilization" value={formatPercent(cloudMetrics?.cpu_percent)} detail="CloudWatch Agent · CPU busy" tone="sage" />
                <MetricCard icon={<Activity size={19} />} label="Memory usage" value={formatPercent(cloudMetrics?.memory_percent)} detail="mem_used_percent" tone="blue" />
                <MetricCard icon={<HardDrive size={19} />} label="Disk utilization" value={formatPercent(cloudMetrics?.disk_percent)} detail="disk_used_percent" tone="gold" />
                <MetricCard icon={<ShieldCheck size={19} />} label="High CPU alarm" value={getAlarmState(cloudMetrics)} detail={cloudMetrics?.alarms[0]?.name ?? 'CloudWatch alarm'} tone={getAlarmTone(cloudMetrics)} />
              </section>

              {metricsError && <div className="error-message">{metricsError}</div>}

              <div className="panel infra-details">
                <div className="panel-header">
                  <div>
                    <h3>Infrastructure details</h3>
                    <p>Current deployment configuration</p>
                  </div>
                </div>
                <InfoRow label="Cloud provider" value="Amazon Web Services" />
                <InfoRow label="Region" value="us-east-1 · N. Virginia" />
                <InfoRow label="Compute" value="EC2 · t3.micro" />
                <InfoRow label="Container engine" value="Docker" />
                <InfoRow label="Infrastructure as Code" value="Terraform" />
                <InfoRow label="Monitoring namespace" value="CloudDeploy/EC2" />
              </div>
            </>
          )}

          {page === 'Deployments' && (
            <>
              <div className="deploy-summary">
                <div className="deploy-summary-icon"><GitBranch size={21} /></div>
                <div>
                  <strong>GitHub Actions CI/CD</strong>
                  <p>Live workflow history from your private CloudDeploy repository.</p>
                </div>
                <span className="configured-pill">
                  <CheckCircle2 size={14} /> Connected
                </span>
              </div>

              <div className="panel deployment-panel">
                <div className="panel-header">
                  <div>
                    <h3>Workflow runs</h3>
                    <p>
                      {workflowTotal} total runs · branch master
                      {lastWorkflowUpdate && (
                        <> · Updated {new Date(lastWorkflowUpdate).toLocaleTimeString()}</>
                      )}
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => void loadWorkflows()}
                    disabled={workflowsLoading}
                  >
                    <RefreshCw size={15} className={workflowsLoading ? 'spin' : ''} />
                    {workflowsLoading ? 'Refreshing…' : 'Refresh runs'}
                  </button>
                </div>

                {workflowsError && (
                  <div className="error-message">
                    <AlertCircle size={17} /> {workflowsError}
                  </div>
                )}

                {workflowsLoading && workflowRuns.length === 0 ? (
                  <p className="empty-state">Loading GitHub Actions runs…</p>
                ) : workflowRuns.length > 0 ? (
                  <div className="workflow-list">
                    {workflowRuns.map((run) => (
                      <div className="deployment-step workflow-run" key={run.id}>
                        <div className={`step-number ${getWorkflowTone(run)}`}>
                          {getWorkflowIcon(run)}
                        </div>

                        <div className="step-copy workflow-copy">
                          <strong>
                            Run #{run.run_number}: {run.name}
                          </strong>
                          <span>
                            Branch: {run.branch || 'unknown'} · Commit: {run.commit || 'unknown'}
                          </span>
                          <span>
                            <Clock size={13} />
                            {' '}{formatDate(run.created_at)}
                          </span>
                        </div>

                        <span className={`workflow-status ${getWorkflowTone(run)}`}>
                          {getWorkflowStatus(run)}
                        </span>

                        <a
                          className="workflow-open"
                          href={run.html_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open workflow run ${run.run_number} on GitHub`}
                          title="Open on GitHub"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : !workflowsLoading && !workflowsError ? (
                  <p className="empty-state">No workflow runs were returned by GitHub.</p>
                ) : null}

                <a
                  className="github-link"
                  href="https://github.com/divyanshibhagi2005-debug/CloudDeploy/actions"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open all GitHub Actions <ExternalLink size={15} />
                </a>
              </div>

              <div className="deployment-note">
                <Code2 size={17} />
                <span>
                  Workflow history is retrieved from GitHub's API through the Flask backend.
                  The GitHub token stays on the backend and is not exposed to the browser.
                </span>
              </div>
            </>
          )}

          <footer className="page-footer">
            <div>
              <span className={`footer-status ${apiStatus}`} />
              API {apiStatus === 'online' ? 'connected' : apiStatus === 'offline' ? 'unavailable' : 'checking'}
              <span className="footer-separator">·</span> CloudDeploy
            </div>
            <div>
              Built with React, Flask & AWS
              <span className="footer-separator">·</span>
              <span className="footer-version">v1.0</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}

function getWorkflowStatus(run: WorkflowRun) {
  if (run.status !== 'completed') {
    return run.status === 'in_progress'
      ? 'In progress'
      : run.status === 'queued'
        ? 'Queued'
        : run.status || 'Unknown'
  }

  switch (run.conclusion) {
    case 'success':
      return 'Success'
    case 'failure':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'timed_out':
      return 'Timed out'
    case 'skipped':
      return 'Skipped'
    case 'action_required':
      return 'Action required'
    default:
      return run.conclusion || 'Completed'
  }
}

function getWorkflowTone(run: WorkflowRun) {
  if (run.status !== 'completed') return 'running'
  if (run.conclusion === 'success') return 'success'
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out') return 'failure'
  if (run.conclusion === 'cancelled' || run.conclusion === 'skipped') return 'neutral'
  return 'neutral'
}

function getWorkflowIcon(run: WorkflowRun) {
  if (run.status !== 'completed') return <Clock size={17} />
  if (run.conclusion === 'success') return <CheckCircle2 size={17} />
  if (run.conclusion === 'failure') return <AlertCircle size={17} />
  return <Code2 size={17} />
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()
}

function formatPercent(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(2)}%`
    : 'Unavailable'
}

function getAlarmState(metrics: CloudWatchMetrics | null) {
  if (!metrics) return 'Unavailable'
  return metrics.alarms[0]?.state ?? 'No alarm found'
}

function getAlarmTone(metrics: CloudWatchMetrics | null) {
  const state = metrics?.alarms[0]?.state
  if (state === 'OK') return 'green'
  if (state === 'ALARM') return 'red'
  return 'neutral'
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
  tone: string
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <div className={`metric-icon ${tone}`}>{icon}</div>
        <span className="metric-menu">•••</span>
      </div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default App
