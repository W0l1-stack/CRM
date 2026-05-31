package contacts

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/database"
	"crm-go-api/internal/models"
)

// testDB connects to TEST_DATABASE_URL, applies migrations, and returns a pool.
// The whole suite is skipped when TEST_DATABASE_URL is not set (e.g. local runs
// without Postgres); CI provides it.
func testDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping contacts repository integration tests")
	}
	ctx := context.Background()
	pool, err := database.Connect(ctx, url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// seedAccount inserts a throwaway account and returns its id.
func seedAccount(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(),
		`INSERT INTO accounts (name) VALUES ('test account') RETURNING id`,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seed account: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM accounts WHERE id = $1`, id)
	})
	return id
}

func strptr(s string) *string { return &s }

func TestCreateAndGetContact(t *testing.T) {
	pool := testDB(t)
	repo := NewRepository(pool)
	ctx := context.Background()
	accountID := seedAccount(t, pool)

	in := &models.Contact{
		Name:         "Ada Lovelace",
		Email:        strptr("ada@example.com"),
		Tags:         []string{"hot lead"},
		CustomFields: map[string]interface{}{"industry": "computing"},
	}
	created, err := repo.Create(ctx, accountID, in)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if created.ID == uuid.Nil {
		t.Fatal("expected generated id")
	}

	got, err := repo.GetByID(ctx, accountID, created.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.Name != "Ada Lovelace" {
		t.Errorf("name = %q, want Ada Lovelace", got.Name)
	}
	if len(got.Tags) != 1 || got.Tags[0] != "hot lead" {
		t.Errorf("tags = %v, want [hot lead]", got.Tags)
	}
	if got.CustomFields["industry"] != "computing" {
		t.Errorf("custom_fields[industry] = %v, want computing", got.CustomFields["industry"])
	}
}

func TestTenantIsolation(t *testing.T) {
	pool := testDB(t)
	repo := NewRepository(pool)
	ctx := context.Background()
	accountA := seedAccount(t, pool)
	accountB := seedAccount(t, pool)

	created, err := repo.Create(ctx, accountA, &models.Contact{Name: "Account A Contact"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Account B must not be able to read Account A's contact.
	if _, err := repo.GetByID(ctx, accountB, created.ID); err != ErrNotFound {
		t.Errorf("cross-tenant GetByID error = %v, want ErrNotFound", err)
	}
}

func TestUpdateAndDeleteContact(t *testing.T) {
	pool := testDB(t)
	repo := NewRepository(pool)
	ctx := context.Background()
	accountID := seedAccount(t, pool)

	created, err := repo.Create(ctx, accountID, &models.Contact{Name: "Temp"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	created.Name = "Renamed"
	updated, err := repo.Update(ctx, accountID, created.ID, created)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Name != "Renamed" {
		t.Errorf("name = %q, want Renamed", updated.Name)
	}

	if err := repo.Delete(ctx, accountID, created.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := repo.GetByID(ctx, accountID, created.ID); err != ErrNotFound {
		t.Errorf("after delete GetByID error = %v, want ErrNotFound", err)
	}
}

func TestListFiltersByTag(t *testing.T) {
	pool := testDB(t)
	repo := NewRepository(pool)
	ctx := context.Background()
	accountID := seedAccount(t, pool)

	if _, err := repo.Create(ctx, accountID, &models.Contact{Name: "Hot", Tags: []string{"hot lead"}}); err != nil {
		t.Fatalf("Create hot: %v", err)
	}
	if _, err := repo.Create(ctx, accountID, &models.Contact{Name: "Cold", Tags: []string{"cold"}}); err != nil {
		t.Fatalf("Create cold: %v", err)
	}

	list, err := repo.List(ctx, accountID, "", "hot lead")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 1 || list[0].Name != "Hot" {
		t.Errorf("filtered list = %+v, want exactly the Hot contact", list)
	}
}
