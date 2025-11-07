/**
 * Content Version Data Transfer Object
 */
export class ContentVersionDTO {
  static toVersionResponse(version) {
    return {
      version_id: version.version_id,
      content_id: version.content_id,
      version_number: version.version_number,
      content_data: version.content_data,
      created_by: version.created_by,
      is_current_version: version.is_current_version,
      change_description: version.change_description,
      parent_version_id: version.parent_version_id,
      created_at: version.created_at.toISOString(),
    };
  }

  static toVersionSummary(version) {
    return {
      version_id: version.version_id,
      version_number: version.version_number,
      created_by: version.created_by,
      created_at: version.created_at.toISOString(),
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



