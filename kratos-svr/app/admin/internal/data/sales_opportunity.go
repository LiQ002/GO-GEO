package data

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

type salesOpportunityRepo struct{ data *Data }

func NewSalesOpportunityRepo(data *Data) biz.SalesOpportunityRepo {
	return &salesOpportunityRepo{data: data}
}

func (r *salesOpportunityRepo) Create(ctx context.Context, item *biz.SalesOpportunity, operatorID uint64) (*biz.SalesOpportunity, error) {
	var id uint64
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := ensureSalesOpportunityOwner(tx, item.OwnerAdminID); err != nil {
			return err
		}
		po := salesOpportunityPO(item)
		if err := tx.Create(po).Error; err != nil {
			return err
		}
		id = po.ID
		if err := replaceSalesOpportunityChildren(tx, po.ID, item); err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, operatorID, "sales_opportunity.create", "sales_opportunity", strconv.FormatUint(po.ID, 10), "success", "", nil, po)
	})
	if err != nil {
		return nil, mapSalesOpportunityError(err)
	}
	return r.Get(ctx, id, biz.SalesOpportunityAccess{AdminUserID: operatorID, DataScope: biz.AdminRoleDataScopeAll})
}

func (r *salesOpportunityRepo) Get(ctx context.Context, id uint64, access biz.SalesOpportunityAccess) (*biz.SalesOpportunity, error) {
	var record model.SalesOpportunity
	if err := scopeSalesOpportunityQuery(r.data.DB(ctx).Model(&model.SalesOpportunity{}), access).First(&record, id).Error; err != nil {
		return nil, mapSalesOpportunityError(err)
	}
	items, err := r.hydrate(ctx, []model.SalesOpportunity{record})
	if err != nil {
		return nil, err
	}
	return items[0], nil
}

func (r *salesOpportunityRepo) List(ctx context.Context, opts biz.SalesOpportunityListOptions, access biz.SalesOpportunityAccess) ([]*biz.SalesOpportunity, int64, error) {
	db := scopeSalesOpportunityQuery(r.data.DB(ctx).Model(&model.SalesOpportunity{}), access)
	if keyword := strings.TrimSpace(opts.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("name LIKE ? OR code LIKE ? OR customer_name LIKE ? OR website LIKE ? OR brand_name LIKE ? OR contact_name LIKE ? OR contact_phone LIKE ? OR contact_email LIKE ?", like, like, like, like, like, like, like, like)
	}
	if opts.Status != 0 {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.OwnerAdminID != nil {
		db = db.Where("owner_admin_id = ?", *opts.OwnerAdminID)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, mapSalesOpportunityError(err)
	}
	var records []model.SalesOpportunity
	if err := db.Order("updated_at DESC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, mapSalesOpportunityError(err)
	}
	items, err := r.hydrate(ctx, records)
	return items, total, err
}

func (r *salesOpportunityRepo) Update(ctx context.Context, item *biz.SalesOpportunity, operatorID uint64, access biz.SalesOpportunityAccess) (*biz.SalesOpportunity, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.SalesOpportunity
		if err := scopeSalesOpportunityQuery(tx.Model(&model.SalesOpportunity{}), access).First(&before, item.ID).Error; err != nil {
			return err
		}
		if err := ensureSalesOpportunityOwner(tx, item.OwnerAdminID); err != nil {
			return err
		}
		updates := map[string]any{
			"name": item.Name, "owner_admin_id": item.OwnerAdminID, "customer_name": item.CustomerName,
			"website": item.Website, "industry": item.Industry, "region": item.Region,
			"contact_name": item.ContactName, "contact_phone": item.ContactPhone, "contact_email": item.ContactEmail,
			"brand_name": item.BrandName, "target_audience": item.TargetAudience, "core_value": item.CoreValue,
			"current_content": item.CurrentContent, "pain_points": item.PainPoints, "expected_goals": item.ExpectedGoals,
			"budget_min_minor_units": item.BudgetMinMinorUnits, "budget_max_minor_units": item.BudgetMaxMinorUnits,
			"currency": item.Currency, "remark": item.Remark, "version": gorm.Expr("version + 1"),
		}
		result := scopeSalesOpportunityQuery(tx.Model(&model.SalesOpportunity{}), access).
			Where("id = ? AND version = ?", item.ID, item.Version).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrSalesOpportunityConflict
		}
		if err := replaceSalesOpportunityChildren(tx, item.ID, item); err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, operatorID, "sales_opportunity.update", "sales_opportunity", strconv.FormatUint(item.ID, 10), "success", "", before, updates)
	})
	if err != nil {
		return nil, mapSalesOpportunityError(err)
	}
	return r.Get(ctx, item.ID, access)
}

func (r *salesOpportunityRepo) ChangeStatus(ctx context.Context, cmd biz.SalesOpportunityStatusCommand) (*biz.SalesOpportunity, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var before model.SalesOpportunity
		if err := scopeSalesOpportunityQuery(tx.Model(&model.SalesOpportunity{}), cmd.Access).First(&before, cmd.ID).Error; err != nil {
			return err
		}
		var closedAt *time.Time
		if cmd.Status == biz.SalesOpportunityStatusClosed {
			now := time.Now().UTC()
			closedAt = &now
		}
		updates := map[string]any{
			"status": cmd.Status, "closed_at": closedAt, "version": gorm.Expr("version + 1"),
		}
		result := scopeSalesOpportunityQuery(tx.Model(&model.SalesOpportunity{}), cmd.Access).
			Where("id = ? AND version = ?", cmd.ID, cmd.Version).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrSalesOpportunityConflict
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "sales_opportunity.status.change", "sales_opportunity", strconv.FormatUint(cmd.ID, 10), "success", cmd.Reason, before, updates)
	})
	if err != nil {
		return nil, mapSalesOpportunityError(err)
	}
	return r.Get(ctx, cmd.ID, cmd.Access)
}

func (r *salesOpportunityRepo) CheckDuplicate(ctx context.Context, opts biz.SalesOpportunityDuplicateOptions) (bool, []*biz.SalesOpportunity, error) {
	db := scopeSalesOpportunityQuery(r.data.DB(ctx).Model(&model.SalesOpportunity{}), opts.Access)
	if opts.CustomerName != "" && opts.Website != "" {
		db = db.Where("customer_name = ? OR website = ?", opts.CustomerName, opts.Website)
	} else if opts.CustomerName != "" {
		db = db.Where("customer_name = ?", opts.CustomerName)
	} else {
		db = db.Where("website = ?", opts.Website)
	}
	if opts.ExcludeID != nil {
		db = db.Where("id <> ?", *opts.ExcludeID)
	}
	var records []model.SalesOpportunity
	if err := db.Order("updated_at DESC, id DESC").Limit(10).Find(&records).Error; err != nil {
		return false, nil, mapSalesOpportunityError(err)
	}
	items, err := r.hydrate(ctx, records)
	return len(items) > 0, items, err
}

func (r *salesOpportunityRepo) ListOwners(ctx context.Context, keyword string, access biz.SalesOpportunityAccess) ([]*biz.SalesOpportunityOwner, error) {
	db := r.data.DB(ctx).Table(model.TableAdminUsers+" AS u").
		Select("DISTINCT u.id, u.username, u.display_name, u.email").
		Joins("JOIN "+model.TableAdminRoleBindings+" AS b ON b.admin_user_id = u.id").
		Joins("JOIN "+model.TableAdminRoles+" AS r ON r.id = b.role_id AND r.deleted_at IS NULL AND r.status = ?", model.AdminRoleStatusActive).
		Joins("JOIN "+model.TableAdminRolePermissions+" AS rp ON rp.role_id = r.id").
		Joins("JOIN "+model.TableAdminPermissions+" AS p ON p.id = rp.permission_id").
		Where("u.deleted_at IS NULL AND u.status = ?", "active").
		Where("p.code IN ?", []string{"platform.all", "sales.opportunity.read", "sales.opportunity.manage"})
	if !access.CanAssignOthers() {
		db = db.Where("u.id = ?", access.AdminUserID)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?", like, like, like)
	}
	var records []struct {
		ID          uint64
		Username    string
		DisplayName string
		Email       string
	}
	if err := db.Order("u.display_name ASC, u.id ASC").Limit(200).Scan(&records).Error; err != nil {
		return nil, err
	}
	items := make([]*biz.SalesOpportunityOwner, 0, len(records))
	for _, record := range records {
		items = append(items, &biz.SalesOpportunityOwner{
			ID: record.ID, Username: record.Username, DisplayName: record.DisplayName, Email: record.Email,
		})
	}
	return items, nil
}

func (r *salesOpportunityRepo) hydrate(ctx context.Context, records []model.SalesOpportunity) ([]*biz.SalesOpportunity, error) {
	items := make([]*biz.SalesOpportunity, 0, len(records))
	if len(records) == 0 {
		return items, nil
	}
	ids := make([]uint64, 0, len(records))
	ownerIDs := make([]uint64, 0, len(records))
	byID := make(map[uint64]*biz.SalesOpportunity, len(records))
	for i := range records {
		item := salesOpportunityDO(&records[i])
		ids = append(ids, records[i].ID)
		ownerIDs = append(ownerIDs, records[i].OwnerAdminID)
		byID[item.ID] = item
		items = append(items, item)
	}
	var owners []model.AdminUser
	if err := r.data.DB(ctx).Where("id IN ?", ownerIDs).Find(&owners).Error; err != nil {
		return nil, mapSalesOpportunityError(err)
	}
	ownerNames := make(map[uint64]string, len(owners))
	for i := range owners {
		ownerNames[owners[i].ID] = owners[i].DisplayName
	}
	for _, item := range items {
		item.OwnerDisplayName = ownerNames[item.OwnerAdminID]
	}
	var aliases []model.SalesOpportunityBrandAlias
	if err := r.data.DB(ctx).Where("opportunity_id IN ?", ids).Order("opportunity_id ASC, sort_order ASC, id ASC").Find(&aliases).Error; err != nil {
		return nil, mapSalesOpportunityError(err)
	}
	for i := range aliases {
		item := byID[aliases[i].OpportunityID]
		item.BrandAliases = append(item.BrandAliases, &biz.SalesOpportunityBrandAlias{ID: aliases[i].ID, Alias: aliases[i].Alias, SortOrder: aliases[i].SortOrder})
	}
	var products []model.SalesOpportunityProduct
	if err := r.data.DB(ctx).Where("opportunity_id IN ?", ids).Order("opportunity_id ASC, sort_order ASC, id ASC").Find(&products).Error; err != nil {
		return nil, mapSalesOpportunityError(err)
	}
	for i := range products {
		item := byID[products[i].OpportunityID]
		item.Products = append(item.Products, &biz.SalesOpportunityProduct{
			ID: products[i].ID, Name: products[i].Name, Description: products[i].Description,
			SellingPoints: products[i].SellingPoints, TargetAudience: products[i].TargetAudience, SortOrder: products[i].SortOrder,
		})
	}
	var competitors []model.SalesOpportunityCompetitor
	if err := r.data.DB(ctx).Where("opportunity_id IN ?", ids).Order("opportunity_id ASC, sort_order ASC, id ASC").Find(&competitors).Error; err != nil {
		return nil, mapSalesOpportunityError(err)
	}
	for i := range competitors {
		item := byID[competitors[i].OpportunityID]
		item.Competitors = append(item.Competitors, &biz.SalesOpportunityCompetitor{
			ID: competitors[i].ID, Name: competitors[i].Name, Website: competitors[i].Website,
			Description: competitors[i].Description, SortOrder: competitors[i].SortOrder,
		})
	}
	return items, nil
}

func scopeSalesOpportunityQuery(db *gorm.DB, access biz.SalesOpportunityAccess) *gorm.DB {
	if access.CanAccessAll() {
		return db
	}
	return db.Where("owner_admin_id = ?", access.AdminUserID)
}

func ensureSalesOpportunityOwner(tx *gorm.DB, ownerID uint64) error {
	var count int64
	if err := tx.Model(&model.AdminUser{}).Where("id = ? AND status = ?", ownerID, "active").Count(&count).Error; err != nil {
		return err
	}
	if count != 1 {
		return biz.ErrSalesOpportunityInvalid
	}
	return nil
}

func replaceSalesOpportunityChildren(tx *gorm.DB, opportunityID uint64, item *biz.SalesOpportunity) error {
	for _, target := range []any{&model.SalesOpportunityBrandAlias{}, &model.SalesOpportunityProduct{}, &model.SalesOpportunityCompetitor{}} {
		if err := tx.Where("opportunity_id = ?", opportunityID).Delete(target).Error; err != nil {
			return err
		}
	}
	aliases := make([]model.SalesOpportunityBrandAlias, 0, len(item.BrandAliases))
	for _, alias := range item.BrandAliases {
		aliases = append(aliases, model.SalesOpportunityBrandAlias{OpportunityID: opportunityID, Alias: alias.Alias, SortOrder: alias.SortOrder})
	}
	if len(aliases) > 0 {
		if err := tx.Create(&aliases).Error; err != nil {
			return err
		}
	}
	products := make([]model.SalesOpportunityProduct, 0, len(item.Products))
	for _, product := range item.Products {
		products = append(products, model.SalesOpportunityProduct{
			OpportunityID: opportunityID, Name: product.Name, Description: product.Description,
			SellingPoints: product.SellingPoints, TargetAudience: product.TargetAudience, SortOrder: product.SortOrder,
		})
	}
	if len(products) > 0 {
		if err := tx.Create(&products).Error; err != nil {
			return err
		}
	}
	competitors := make([]model.SalesOpportunityCompetitor, 0, len(item.Competitors))
	for _, competitor := range item.Competitors {
		competitors = append(competitors, model.SalesOpportunityCompetitor{
			OpportunityID: opportunityID, Name: competitor.Name, Website: competitor.Website,
			Description: competitor.Description, SortOrder: competitor.SortOrder,
		})
	}
	if len(competitors) > 0 {
		return tx.Create(&competitors).Error
	}
	return nil
}

func salesOpportunityPO(item *biz.SalesOpportunity) *model.SalesOpportunity {
	return &model.SalesOpportunity{
		Code: item.Code, Name: item.Name, OwnerAdminID: item.OwnerAdminID, CustomerName: item.CustomerName,
		Website: item.Website, Industry: item.Industry, Region: item.Region, ContactName: item.ContactName,
		ContactPhone: item.ContactPhone, ContactEmail: item.ContactEmail, BrandName: item.BrandName,
		TargetAudience: item.TargetAudience, CoreValue: item.CoreValue, CurrentContent: item.CurrentContent,
		PainPoints: item.PainPoints, ExpectedGoals: item.ExpectedGoals,
		BudgetMinMinorUnits: item.BudgetMinMinorUnits, BudgetMaxMinorUnits: item.BudgetMaxMinorUnits,
		Currency: item.Currency, Status: item.Status, Remark: item.Remark, Version: item.Version, ClosedAt: item.ClosedAt,
	}
}

func salesOpportunityDO(item *model.SalesOpportunity) *biz.SalesOpportunity {
	return &biz.SalesOpportunity{
		ID: item.ID, Code: item.Code, Name: item.Name, OwnerAdminID: item.OwnerAdminID,
		CustomerName: item.CustomerName, Website: item.Website, Industry: item.Industry, Region: item.Region,
		ContactName: item.ContactName, ContactPhone: item.ContactPhone, ContactEmail: item.ContactEmail,
		BrandName: item.BrandName, TargetAudience: item.TargetAudience, CoreValue: item.CoreValue,
		CurrentContent: item.CurrentContent, PainPoints: item.PainPoints, ExpectedGoals: item.ExpectedGoals,
		BudgetMinMinorUnits: item.BudgetMinMinorUnits, BudgetMaxMinorUnits: item.BudgetMaxMinorUnits,
		Currency: item.Currency, Status: item.Status, Remark: item.Remark, Version: item.Version,
		ClosedAt: item.ClosedAt, CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
		BrandAliases: make([]*biz.SalesOpportunityBrandAlias, 0), Products: make([]*biz.SalesOpportunityProduct, 0),
		Competitors: make([]*biz.SalesOpportunityCompetitor, 0),
	}
}

func mapSalesOpportunityError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, biz.ErrSalesOpportunityConflict):
		return biz.ErrSalesOpportunityConflict
	case errors.Is(err, biz.ErrSalesOpportunityInvalid), errors.Is(err, gorm.ErrForeignKeyViolated):
		return biz.ErrSalesOpportunityInvalid
	case errors.Is(err, gorm.ErrRecordNotFound):
		return biz.ErrSalesOpportunityNotFound
	case errors.Is(err, gorm.ErrDuplicatedKey):
		return biz.ErrSalesOpportunityConflict
	default:
		return err
	}
}
