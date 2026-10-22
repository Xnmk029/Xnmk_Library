"""Timing scores are independent of correctness and do not terminate a run."""
import math

def timing_score(elapsed_seconds, soft_seconds, max_penalty=10.0):
    if not math.isfinite(elapsed_seconds) or elapsed_seconds < 0:
        raise ValueError('elapsed_seconds must be finite and nonnegative')
    if not math.isfinite(soft_seconds) or soft_seconds <= 0:
        raise ValueError('soft_seconds must be finite and positive')
    overtime=max(0.0,elapsed_seconds-soft_seconds)
    penalty=min(max_penalty,10.0*overtime/soft_seconds)
    return {'soft_budget_seconds':soft_seconds,'elapsed_seconds':round(elapsed_seconds,3),
            'overtime_seconds':round(overtime,3),'time_penalty_points':round(penalty,3),
            'max_time_penalty_points':max_penalty,'time_policy':'penalty-no-deadline'}

def budget_for(spec, project):
    return spec.get('soft_seconds_by_project',{}).get(project,spec.get('soft_seconds',spec.get('wall_seconds',1800)))
