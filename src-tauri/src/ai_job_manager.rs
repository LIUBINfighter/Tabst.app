use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use serde::Serialize;

use crate::now_ms;

const JOB_RETENTION_MS: u64 = 5 * 60 * 1000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmrRawResult {
    pub(crate) alpha_tex: String,
    pub(crate) raw_response: String,
    pub(crate) tokens_used: u64,
    pub(crate) duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum OmrJobStatus {
    Pending,
    Running,
    Completed,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmrJob {
    pub(crate) job_id: String,
    pub(crate) status: OmrJobStatus,
    pub(crate) created_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) result: Option<OmrRawResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Default)]
pub(crate) struct OmrJobManager {
    jobs: Mutex<HashMap<String, OmrJob>>,
    active_job_id: Mutex<Option<String>>,
    cancelled_job_ids: Mutex<HashSet<String>>,
}

impl OmrJobManager {
    pub(crate) fn start_job(&self) -> Result<String, String> {
        self.cleanup_old_jobs();

        let mut active = self
            .active_job_id
            .lock()
            .map_err(|_| "job-lock-failed".to_string())?;
        if active.is_some() {
            return Err("provider-busy".to_string());
        }

        let job_id = format!("omr-{}", now_ms());
        let job = OmrJob {
            job_id: job_id.clone(),
            status: OmrJobStatus::Running,
            created_at: now_ms(),
            result: None,
            error: None,
        };

        let mut jobs = self
            .jobs
            .lock()
            .map_err(|_| "job-lock-failed".to_string())?;
        jobs.insert(job_id.clone(), job);
        *active = Some(job_id.clone());

        Ok(job_id)
    }

    pub(crate) fn get_job(&self, job_id: &str) -> Result<OmrJob, String> {
        self.cleanup_old_jobs();
        let jobs = self
            .jobs
            .lock()
            .map_err(|_| "job-lock-failed".to_string())?;
        jobs.get(job_id)
            .cloned()
            .ok_or_else(|| "job-not-found".to_string())
    }

    pub(crate) fn complete_job(&self, job_id: &str, result: OmrRawResult) -> Result<(), String> {
        let mut jobs = self
            .jobs
            .lock()
            .map_err(|_| "job-lock-failed".to_string())?;
        if let Some(job) = jobs.get_mut(job_id) {
            if job.status == OmrJobStatus::Cancelled {
                self.clear_active_job(job_id)?;
                return Ok(());
            }
            job.status = OmrJobStatus::Completed;
            job.result = Some(result);
            job.error = None;
        }
        drop(jobs);
        self.clear_active_job(job_id)
    }

    pub(crate) fn fail_job(&self, job_id: &str, error: String) -> Result<(), String> {
        let mut jobs = self
            .jobs
            .lock()
            .map_err(|_| "job-lock-failed".to_string())?;
        if let Some(job) = jobs.get_mut(job_id) {
            if job.status != OmrJobStatus::Cancelled {
                job.status = OmrJobStatus::Failed;
                job.error = Some(error);
            }
        }
        drop(jobs);
        self.clear_active_job(job_id)
    }

    pub(crate) fn cancel_job(&self, job_id: &str) -> Result<(), String> {
        let mut jobs = self
            .jobs
            .lock()
            .map_err(|_| "job-lock-failed".to_string())?;
        let job = jobs
            .get_mut(job_id)
            .ok_or_else(|| "job-not-found".to_string())?;
        job.status = OmrJobStatus::Cancelled;
        job.error = Some("omr-cancelled".to_string());
        drop(jobs);

        self.cancelled_job_ids
            .lock()
            .map_err(|_| "job-lock-failed".to_string())?
            .insert(job_id.to_string());
        Ok(())
    }

    pub(crate) fn is_cancelled(&self, job_id: &str) -> bool {
        self.cancelled_job_ids
            .lock()
            .map(|cancelled| cancelled.contains(job_id))
            .unwrap_or(false)
    }

    fn clear_active_job(&self, job_id: &str) -> Result<(), String> {
        let mut active = self
            .active_job_id
            .lock()
            .map_err(|_| "job-lock-failed".to_string())?;
        if active.as_deref() == Some(job_id) {
            *active = None;
        }
        Ok(())
    }

    fn cleanup_old_jobs(&self) {
        let cutoff = now_ms().saturating_sub(JOB_RETENTION_MS);
        let Ok(mut jobs) = self.jobs.lock() else {
            return;
        };
        jobs.retain(|_, job| {
            job.status == OmrJobStatus::Running
                || job.status == OmrJobStatus::Pending
                || job.created_at >= cutoff
        });
    }
}
