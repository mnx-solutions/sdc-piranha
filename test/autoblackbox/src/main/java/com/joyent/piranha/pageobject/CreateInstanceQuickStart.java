package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class CreateInstanceQuickStart extends AbstractPageObject {
    public static final String TITLE = "Quick Start: Create Instance";

    @Override
    String getTitle() {
        return TITLE;
    }

    public CreateInstance clickViewMoreImages() {
        $("#link-more-images").click();
        return page(CreateInstance.class);
    }

    public void selectDataCenter(String datacenter) {
        waitForMediumSpinnerDisappear();
        $(".dropdown-toggle.datacenter-select").click();
        $("ul.dd-datacenter").$(byText(datacenter)).click();
    }

    public Instances clickLaunchButton(String tierName) {
        getImageRepeater(tierName).click();
        return page(Instances.class);
    }

    public SelenideElement getImageRepeater(String tierName) {
        return $(By.xpath("//div[@data-ng-repeat and contains(.,\'" + tierName + "\')]"));
    }

    public String getFreeTierInfo(String tierName) {
        return getImageRepeater(tierName).$(".freetier-info").getText();
    }
}
