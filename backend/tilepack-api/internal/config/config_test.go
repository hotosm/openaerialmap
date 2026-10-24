package config

import "testing"

func TestValidateTimeouts(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name: "shipped defaults",
			cfg: Config{
				LockTTLSeconds:                300,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           3600,
			},
		},
		{
			name: "a lock that outlives its job is rejected",
			cfg: Config{
				LockTTLSeconds:                11400,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           3600,
			},
			wantErr: true,
		},
		{
			name: "a lock ttl equal to the job ttl is allowed",
			cfg: Config{
				LockTTLSeconds:                3600,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           3600,
			},
		},
		{
			name: "one second past the job ttl is rejected",
			cfg: Config{
				LockTTLSeconds:                3601,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           3600,
			},
			wantErr: true,
		},
		{
			name: "zero lock ttl is rejected",
			cfg: Config{
				LockTTLSeconds:                0,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           3600,
			},
			wantErr: true,
		},
		{
			name: "deadline must be positive",
			cfg: Config{
				LockTTLSeconds:                300,
				WorkerActiveDeadlineSeconds:   0,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           3600,
			},
			wantErr: true,
		},
		{
			name: "zero grace is rejected",
			cfg: Config{
				LockTTLSeconds:                300,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 0,
				WorkerJobTTLSeconds:           3600,
			},
			wantErr: true,
		},
		{
			name: "zero job ttl is rejected",
			cfg: Config{
				LockTTLSeconds:                300,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: 60,
				WorkerJobTTLSeconds:           0,
			},
			wantErr: true,
		},
		{
			name: "negative grace is rejected",
			cfg: Config{
				LockTTLSeconds:                300,
				WorkerActiveDeadlineSeconds:   10800,
				WorkerTerminationGraceSeconds: -1,
				WorkerJobTTLSeconds:           3600,
			},
			wantErr: true,
		},
		{
			name: "negative job ttl is rejected",
			cfg: Config{
				LockTTLSeconds:                300,
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

func TestWorkerSkipEmptyTilesDefaultsOn(t *testing.T) {
	if got := getenvBool("WORKER_SKIP_EMPTY_TILES", true); !got {
		t.Fatal("prefilter must default on")
	}
	t.Setenv("WORKER_SKIP_EMPTY_TILES", "false")
	if got := getenvBool("WORKER_SKIP_EMPTY_TILES", true); got {
		t.Fatal("operators must be able to turn the prefilter off")
	}
	t.Setenv("WORKER_SKIP_EMPTY_TILES", "nonsense")
	if got := getenvBool("WORKER_SKIP_EMPTY_TILES", true); !got {
		t.Fatal("an unparsable value must keep the default")
	}
}
