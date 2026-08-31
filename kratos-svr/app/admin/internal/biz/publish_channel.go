package biz

import (
	"context"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrPublishChannelNotFound    = errors.NotFound("PUBLISH_CHANNEL_NOT_FOUND", "publish channel not found")
	ErrPublishChannelInvalid     = errors.BadRequest("PUBLISH_CHANNEL_INVALID", "invalid publish channel")
	ErrPublishChannelConflict    = errors.Conflict("PUBLISH_CHANNEL_CONFLICT", "publish channel version conflict")
	ErrPublishChannelIconInvalid = errors.BadRequest("PUBLISH_CHANNEL_ICON_INVALID", "invalid publish channel icon")
	ErrPublishChannelIconStorage = errors.InternalServer("PUBLISH_CHANNEL_ICON_STORAGE", "unable to store publish channel icon")
	ErrPublishTargetNotFound     = errors.NotFound("PUBLISH_TARGET_NOT_FOUND", "publish target not found")
)

type PublishChannel struct {
	ID                                              uint64
	Code, LoginURL, Name, Icon, Description, DriverVersion string
	Category, Status, AuthorizationType, ExecutionMode int32
	DriverType                                      int32
	SortOrder                                       int32
	Version                                         uint64
	CreatedAt, UpdatedAt                            time.Time
}
type PublishTarget struct {
	ID, PublishChannelID                                                                           uint64
	Name, Platform, EntryURL, SubmissionEmail, Region, Industry, CooperationJSON, RequirementsJSON string
	TargetType, Status                                                                             int32
	SortOrder                                                                                      int32
	Version                                                                                        uint64
	CreatedAt, UpdatedAt                                                                           time.Time
}
type PublishChannelListOptions struct {
	Offset, Limit    int
	Category, Status int32
	Keyword          string
}
type PublishTargetListOptions struct {
	PublishChannelID   uint64
	TargetType, Status int32
}

type PublishChannelRepo interface {
	Create(context.Context, *PublishChannel) (*PublishChannel, error)
	Get(context.Context, uint64) (*PublishChannel, error)
	List(context.Context, PublishChannelListOptions) ([]*PublishChannel, int64, error)
	Update(context.Context, *PublishChannel) (*PublishChannel, error)
	Delete(context.Context, uint64, uint64) error
	CreateTarget(context.Context, *PublishTarget) (*PublishTarget, error)
	ListTargets(context.Context, PublishTargetListOptions) ([]*PublishTarget, error)
	UpdateTarget(context.Context, *PublishTarget) (*PublishTarget, error)
	DeleteTarget(context.Context, uint64, uint64, uint64) error
}

type PublishChannelUsecase struct{ repo PublishChannelRepo }

func NewPublishChannelUsecase(repo PublishChannelRepo) *PublishChannelUsecase {
	return &PublishChannelUsecase{repo: repo}
}
func (uc *PublishChannelUsecase) Create(ctx context.Context, item *PublishChannel) (*PublishChannel, error) {
	if item != nil && item.Status == 0 {
		item.Status = PublishChannelStatusDisabled
	}
	if err := validatePublishChannel(item); err != nil {
		return nil, err
	}
	return uc.repo.Create(ctx, item)
}
func (uc *PublishChannelUsecase) Get(ctx context.Context, id uint64) (*PublishChannel, error) {
	if id == 0 {
		return nil, ErrPublishChannelInvalid
	}
	return uc.repo.Get(ctx, id)
}
func (uc *PublishChannelUsecase) List(ctx context.Context, opts PublishChannelListOptions) ([]*PublishChannel, int64, error) {
	return uc.repo.List(ctx, opts)
}
func (uc *PublishChannelUsecase) Update(ctx context.Context, item *PublishChannel) (*PublishChannel, error) {
	if item == nil || item.ID == 0 || item.Version == 0 {
		return nil, ErrPublishChannelInvalid
	}
	if err := validatePublishChannel(item); err != nil {
		return nil, err
	}
	current, err := uc.repo.Get(ctx, item.ID)
	if err != nil {
		return nil, err
	}
	if current.Category != item.Category {
		return nil, ErrPublishChannelInvalid
	}
	return uc.repo.Update(ctx, item)
}
func (uc *PublishChannelUsecase) Delete(ctx context.Context, id, version uint64) error {
	if id == 0 || version == 0 {
		return ErrPublishChannelInvalid
	}
	return uc.repo.Delete(ctx, id, version)
}
func (uc *PublishChannelUsecase) CreateTarget(ctx context.Context, item *PublishTarget) (*PublishTarget, error) {
	if item != nil && item.Status == 0 {
		item.Status = PublishChannelStatusActive
	}
	if err := validatePublishTarget(item); err != nil {
		return nil, err
	}
	if err := uc.ensureSubmissionChannel(ctx, item.PublishChannelID); err != nil {
		return nil, err
	}
	return uc.repo.CreateTarget(ctx, item)
}
func (uc *PublishChannelUsecase) ListTargets(ctx context.Context, opts PublishTargetListOptions) ([]*PublishTarget, error) {
	if opts.PublishChannelID == 0 {
		return nil, ErrPublishChannelInvalid
	}
	if err := uc.ensureSubmissionChannel(ctx, opts.PublishChannelID); err != nil {
		return nil, err
	}
	return uc.repo.ListTargets(ctx, opts)
}
func (uc *PublishChannelUsecase) UpdateTarget(ctx context.Context, item *PublishTarget) (*PublishTarget, error) {
	if item == nil || item.ID == 0 || item.Version == 0 {
		return nil, ErrPublishChannelInvalid
	}
	if err := validatePublishTarget(item); err != nil {
		return nil, err
	}
	if err := uc.ensureSubmissionChannel(ctx, item.PublishChannelID); err != nil {
		return nil, err
	}
	return uc.repo.UpdateTarget(ctx, item)
}
func (uc *PublishChannelUsecase) DeleteTarget(ctx context.Context, channelID, targetID, version uint64) error {
	if channelID == 0 || targetID == 0 || version == 0 {
		return ErrPublishChannelInvalid
	}
	if err := uc.ensureSubmissionChannel(ctx, channelID); err != nil {
		return err
	}
	return uc.repo.DeleteTarget(ctx, channelID, targetID, version)
}

func (uc *PublishChannelUsecase) ensureSubmissionChannel(ctx context.Context, channelID uint64) error {
	channel, err := uc.repo.Get(ctx, channelID)
	if err != nil {
		return err
	}
	if channel.Category == PublishChannelCategorySelfMedia {
		return ErrPublishChannelInvalid
	}
	return nil
}

func validatePublishChannel(item *PublishChannel) error {
	if item == nil || strings.TrimSpace(item.Code) == "" || strings.TrimSpace(item.Name) == "" || !inRange(item.Category, PublishChannelCategorySelfMedia, PublishChannelCategoryKOL) || !inRange(item.AuthorizationType, AuthorizationTypeNone, AuthorizationTypeClientLogin) || !inRange(item.ExecutionMode, ExecutionModeAutomatic, ExecutionModeManual) || !inRange(item.Status, PublishChannelStatusActive, PublishChannelStatusMaintenance) {
		return ErrPublishChannelInvalid
	}
	if item.Category == PublishChannelCategorySelfMedia && item.AuthorizationType != AuthorizationTypeClientLogin {
		return ErrPublishChannelInvalid
	}
	if item.Category == PublishChannelCategorySelfMedia && (!inRange(item.DriverType, MediaDriverWechat, MediaDriverCsdn) || !validPlatformLoginURL(item.LoginURL)) {
		return ErrPublishChannelInvalid
	}
	if item.Category != PublishChannelCategorySelfMedia && item.DriverType != 0 {
		return ErrPublishChannelInvalid
	}
	if item.LoginURL != "" && !validPlatformLoginURL(item.LoginURL) {
		return ErrPublishChannelInvalid
	}
	return nil
}
func validatePublishTarget(item *PublishTarget) error {
	if item == nil || item.PublishChannelID == 0 || strings.TrimSpace(item.Name) == "" || !inRange(item.TargetType, PublishChannelCategoryOfficialMedia, PublishChannelCategoryKOL) || !inRange(item.Status, PublishChannelStatusActive, PublishChannelStatusDisabled) || !validJSON(item.CooperationJSON, true) || !validJSON(item.RequirementsJSON, true) {
		return ErrPublishChannelInvalid
	}
	return nil
}
