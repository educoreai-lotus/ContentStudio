/**
 * Content Version Data Transfer Object
 */
export class ContentVersionDTO {
  static toVersionResponse(version) {
    return {
      version_id: version.version_id,
      content_id: version.content_id || null,
      version_number: version.version_number || null, // Deprecated: kept for backward compatibility
      content_data: version.content_data,
      created_by: version.created_by,
      is_current_version: version.is_current_version,
      change_description: version.change_description,
      parent_version_id: version.parent_version_id,
      created_at: version.created_at?.toISOString() || new Date().toISOString(),
      updated_at: version.updated_at?.toISOString() || version.created_at?.toISOString() || new Date().toISOString(),
    };
  }

  static toVersionSummary(version) {
    return {
      version_id: version.version_id,
      version_number: version.version_number || null, // Deprecated: kept for backward compatibility
      created_by: version.created_by,
      created_at: version.created_at?.toISOString() || new Date().toISOString(),
      updated_at: version.updated_at?.toISOString() || version.created_at?.toISOString() || new Date().toISOString(),
      is_current_version: version.is_current_version,
      change_description: version.change_description,
    };
  }

  static toVersionListResponse(versions) {
    return versions.map(version => this.toVersionResponse(version));
  }

  static toVersionSummaryListResponse(versions) {
    return versions.map(version => this.toVersionSummary(version));
  }
}



