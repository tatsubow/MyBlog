class HomeController < ApplicationController
  def index
    # Cookieが無ければ初回アクセスと判断
    @first_visit = cookies[:visited].blank?

    # 初回アクセスならCookieをセット（30日有効）
    cookies[:visited] = 1 if @first_visit
  end
end
