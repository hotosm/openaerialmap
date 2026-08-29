package config

import "testing"

// The lock must outlive the worst-case worker lifetime, and the three
// values live in different places, so the invariant is checked at startup.
func TestValidateTimeouts(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name: "shipped defaults",
			cfg: Config{
				LockTTLSeconds:                11400,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           3600,
			},
		},
		{
			// Pre-0.6.0 production: a worker running to its deadline
			// outlived its own lock, so a second request duplicated it.
			name: "the shipped-broken pairing is rejected",
			cfg: Config{
				LockTTLSeconds:                1800,
				WorkerActiveDeadlineSeconds:   1800,
				WorkerTerminationGraceSeconds: 30,
				WorkerJobTTLSeconds:           3600,
			},
			wantErr: true,
		},
		{
			name: "lock ttl must also cover the grace period",
			cfg: Config{
				LockTTLSeconds:                10830,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           3600,
			},
			wantErr: true,
		},
		{
			name: "one second of headroom is enough",
			cfg: Config{
				LockTTLSeconds:                10861,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           3600,
			},
		},
		{
			name: "deadline must be positive",
			cfg: Config{
				LockTTLSeconds:                11400,
				WorkerActiveDeadlineSeconds:   0,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           3600,
			},
			wantErr: true,
		},
		{
			// Immediate SIGKILL: the handler never runs, the lock leaks.
			name: "zero grace is rejected",
			cfg: Config{
				LockTTLSeconds:                11400,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 0,
				WorkerJobTTLSeconds:           3600,
			},
			wantErr: true,
		},
		{
			// Collects the failed Job instantly, removing the cooldown.
			name: "zero job ttl is rejected",
			cfg: Config{
				LockTTLSeconds:                11400,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           0,
			},
			wantErr: true,
		},
		{
			name: "negative grace is rejected",
			cfg: Config{
				LockTTLSeconds:                11400,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: -1,
				WorkerJobTTLSeconds:           3600,
			},
			wantErr: true,
		},
		{
			name: "negative job ttl is rejected",
			cfg: Config{
				LockTTLSeconds:                11400,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           -1,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cfg.validateTimeouts()
			if tt.wantErr && err == nil {
				t.Fatal("validateTimeouts() = nil, want error")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("validateTimeouts() = %v, want nil", err)
			}
		})
	}
}
